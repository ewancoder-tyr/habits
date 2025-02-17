using System.Security.Claims;
using System.Security.Cryptography.X509Certificates;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Scalar.AspNetCore;
using Serilog;
using Serilog.Events;

namespace Habits.Api;

public sealed record TyrHostConfiguration(
    string DataProtectionKeysPath,
    string DataProtectionCertPath,
    string DataProtectionCertPassword,
    string AuthCookieName,
    string CookiesDomain,
    TimeSpan AuthCookieExpiration,
    string JwtIssuer,
    string JwtAudience,
    string SeqUri,
    string SeqApiKey,
    string LogVerboseNamespace,
    string[] CorsOrigins)
{
    public bool IsDebug { get; init; }
}

public static class HostExtensions
{
    public static async ValueTask ConfigureTyrApplicationBuilderAsync(
        this WebApplicationBuilder builder, TyrHostConfiguration config)
    {
        // Add OpenAPI documentation.
        builder.Services.AddOpenApi(options => options.AddDocumentTransformer<BearerSchemeTransformer>());

        // Data protection, needed for Cookie authentication.
        if (!config.IsDebug)
        {
            var certBytes = await File.ReadAllBytesAsync(config.DataProtectionCertPath);
            var cert = X509CertificateLoader.LoadPkcs12(certBytes, config.DataProtectionCertPassword);
            builder.Services.AddDataProtection()
                .PersistKeysToFileSystem(new DirectoryInfo(config.DataProtectionKeysPath))
                .ProtectKeysWithCertificate(cert);
        }

        // CORS.
        builder.Services.AddCors();

        // Authentication.
        {
            builder.Services.AddAuthorization();
            builder.Services.AddAuthentication("TyrAuthenticationScheme")
                .AddPolicyScheme("TyrAuthenticationScheme", JwtBearerDefaults.AuthenticationScheme, options =>
                {
                    options.ForwardSignOut = CookieAuthenticationDefaults.AuthenticationScheme;
                    options.ForwardDefaultSelector = context =>
                    {
                        if (context.Request.Cookies.ContainsKey(config.AuthCookieName))
                            return CookieAuthenticationDefaults.AuthenticationScheme;

                        return JwtBearerDefaults.AuthenticationScheme;
                    };
                })
                .AddCookie(options =>
                {
                    options.Cookie.HttpOnly = true;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.Cookie.SameSite = SameSiteMode.Strict;
                    options.Cookie.Name = config.AuthCookieName;
                    options.Cookie.Domain = config.CookiesDomain;
                    options.ExpireTimeSpan = config.AuthCookieExpiration;
                    options.SlidingExpiration = true;
                    options.Events.OnRedirectToLogin = context =>
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return Task.CompletedTask;
                    };
                    options.Events.OnCheckSlidingExpiration = context =>
                    {
                        if (context.ShouldRenew)
                            UpdateAuthInfoCookie(
                                context,
                                $"{config.AuthCookieName}Info",
                                config.CookiesDomain);

                        return Task.CompletedTask;
                    };
                    options.Events.OnSignedIn = context =>
                    {
                        UpdateAuthInfoCookie(
                            context,
                            $"{config.AuthCookieName}Info",
                            config.CookiesDomain);

                        return Task.CompletedTask;
                    };
                })
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters.ValidIssuer = config.JwtIssuer;
                    options.TokenValidationParameters.ValidAudience = config.JwtAudience;
                    options.TokenValidationParameters.SignatureValidator = delegate (string token, TokenValidationParameters parameters)
                    {
                        GoogleJsonWebSignature.ValidateAsync(token, new GoogleJsonWebSignature.ValidationSettings
                        {
                            Audience = [config.JwtAudience]
                        });

                        return new Microsoft.IdentityModel.JsonWebTokens.JsonWebToken(token);
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = async context =>
                        {
                            var principal = context.Principal ?? throw new InvalidOperationException("No principal.");
                            var identity = new ClaimsIdentity(principal.Claims, CookieAuthenticationDefaults.AuthenticationScheme);
                            var authProperties = new AuthenticationProperties { IsPersistent = true };

                            await context.HttpContext.SignInAsync(
                                CookieAuthenticationDefaults.AuthenticationScheme,
                                new ClaimsPrincipal(identity),
                                authProperties);
                        }
                    };
                });
        }

        // Logging.
        {
            builder.Host.UseSerilog((context, seqConfig) =>
            {
                seqConfig
                    .MinimumLevel.Information()
                    .MinimumLevel.Override(config.LogVerboseNamespace, LogEventLevel.Verbose)
                    .WriteTo.Console();

                if (!config.IsDebug)
                {
                    seqConfig.WriteTo.Seq(
                        config.SeqUri,
                        apiKey: config.SeqApiKey);
                }
            });
        }
    }

    public static void ConfigureTyrApplication(
        this WebApplication app, TyrHostConfiguration config)
    {
        app.MapOpenApi(); // OpenAPI document.
        app.MapScalarApiReference("docs"); // Scalar on "/docs" url.

        app.UseCors(builder => builder
            .WithOrigins(config.CorsOrigins)
            .AllowAnyMethod()
            .AllowCredentials() // Needed for cookies.
            .WithHeaders("Authorization", "Content-Type"));
        app.UseAuthentication(); // Mandatory to register AFTER CORS.
        app.UseAuthorization();
    }

    private static void UpdateAuthInfoCookie(
        PrincipalContext<CookieAuthenticationOptions> context, string authInfoCookieName, string domain)
    {
        var expirationTime = context.Options.ExpireTimeSpan - TimeSpan.FromSeconds(10); // Account for this code running.
        var expires = DateTimeOffset.UtcNow.Add(expirationTime);

        // If this cookie expires - we need to go and grab another JWT.
        context.HttpContext.Response.Cookies.Append(
            authInfoCookieName,
            $"{expires}|{context.Principal?.Claims.FirstOrDefault(x => x.Type == "picture")?.Value ?? string.Empty}",
            new CookieOptions
            {
                HttpOnly = false,
                Secure = true,
                SameSite = SameSiteMode.Strict,
                Domain = domain,
                Expires = expires
            });
    }
}

internal sealed class BearerSchemeTransformer(IAuthenticationSchemeProvider authenticationSchemeProvider)
    : IOpenApiDocumentTransformer
{
    public async Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        var authenticationSchemes = await authenticationSchemeProvider.GetAllSchemesAsync();
        if (authenticationSchemes.Any(authScheme => authScheme.Name == JwtBearerDefaults.AuthenticationScheme))
        {
            var requirements = new Dictionary<string, OpenApiSecurityScheme>
            {
                ["Bearer"] = new OpenApiSecurityScheme
                {
                    Type = SecuritySchemeType.Http,
                    Scheme = "bearer",
                    In = ParameterLocation.Header,
                    BearerFormat = "Json Web Token"
                }
            };
            document.Components ??= new OpenApiComponents();
            document.Components.SecuritySchemes = requirements;
        }
    }
}
