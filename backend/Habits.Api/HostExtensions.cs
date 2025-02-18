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

public sealed record User(string UserId);
public interface IUserProvider
{
    User GetUser();
}
public sealed class GoogleUserProvider(IHttpContextAccessor httpContextAccessor) : IUserProvider
{
    public User GetUser()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var sub = user?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User is not authenticated.");

        return new($"google_{sub}");
    }
}

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
    string[] CorsOrigins,
    bool UseTyrCorsOrigins,
    string Environment)
{
    public bool IsDebug { get; init; }

    /// <summary>
    /// Mount /app/dataprotection to dataprotection folder with keys.<br />
    /// Mount dp.pfx to pfx certificate file for dataprotection encryption.<br />
    /// Configure:<br />
    /// - DpCertPassword - dataprotection certificate password.<br />
    /// - SeqUri - Seq URI for logs.<br />
    /// - SeqApiKey - Seq API key for logs.<br />
    /// Optional:<br />
    /// - AuthCookieName - TyrAuthSession if not specified, shared between pet projects.<br />
    /// - CookiesDomain - typingrealm.com if not specified, shared between pet projects.<br />
    /// - JwtAudience - google auth client ID, shared between pet projects (main TypingRealm) if not specified.<br />
    /// - CorsOrigins - specific list of origins, all TyR subdomains if not specified.<br />
    /// - Environment - if NOT set then production, otherwise dev-like (allows localhost CORS).<br />
    /// Environment is also appended to the name of the cookie, so that auth doesn't work cross-envs.
    /// </summary>
    /// <param name="appNamespace">Application namespace pattern, for logging Verbose logs.</param>
    public static TyrHostConfiguration Default(IConfiguration configuration, string appNamespace, bool isDebug)
    {
        var useTyrCorsOrigins = false;
        var corsOrigins = TryReadConfig("CorsOrigins", configuration);
        if (corsOrigins is null)
            useTyrCorsOrigins = true;

        var environment = TryReadConfig("Environment", configuration) ?? "Production";
        var authCookieName = TryReadConfig("AuthCookieName", configuration) ?? "TyrAuthSession";
        if (environment != "Production")
            authCookieName = $"{authCookieName}_{environment}";

        return new(
            DataProtectionKeysPath: "/app/dataprotection",
            DataProtectionCertPath: "dp.pfx",
            DataProtectionCertPassword: isDebug ? string.Empty : ReadConfig("DpCertPassword", configuration),
            AuthCookieName: authCookieName,
            CookiesDomain: TryReadConfig("CookiesDomain", configuration) ?? "typingrealm.com",
            AuthCookieExpiration: TimeSpan.FromDays(1.8),
            JwtIssuer: "https://accounts.google.com",
            JwtAudience: TryReadConfig("JwtAudience", configuration) ?? "400839590162-24pngke3ov8rbi2f3forabpaufaosldg.apps.googleusercontent.com",
            SeqUri: isDebug ? string.Empty : ReadConfig("SeqUri", configuration),
            SeqApiKey: isDebug ? string.Empty : ReadConfig("SeqApiKey", configuration),
            LogVerboseNamespace: appNamespace,
            CorsOrigins: corsOrigins?.Split(';') ?? [],
            UseTyrCorsOrigins: useTyrCorsOrigins,
            Environment: environment)
        {
            IsDebug = isDebug
        };
    }

    private static string? TryReadConfig(string name, IConfiguration configuration)
    {
        return configuration[name];
    }

    private static string ReadConfig(string name, IConfiguration configuration)
    {
        return TryReadConfig(name, configuration) ?? throw new InvalidOperationException($"Cannot read {name} from configuration.");
    }
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
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddTransient<IUserProvider, GoogleUserProvider>();
            builder.Services.AddTransient<User>(ctx => ctx.GetRequiredService<IUserProvider>().GetUser());
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
                                $"{config.AuthCookieName}_Info",
                                config.CookiesDomain);

                        return Task.CompletedTask;
                    };
                    options.Events.OnSignedIn = context =>
                    {
                        UpdateAuthInfoCookie(
                            context,
                            $"{config.AuthCookieName}_Info",
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
        var logger = app.Services.GetRequiredService<ILogger<TyrHostConfiguration>>();
        app.MapOpenApi(); // OpenAPI document.
        app.MapScalarApiReference("docs"); // Scalar on "/docs" url.

        var origins = new List<string>();
        if (config.Environment != "Production")
        {
            logger.LogWarning("Environment is not production, allowing localhost CORS.");
            origins.Add("http://localhost:4200");
            origins.Add("https://localhost:4200");
        }

        if (config.UseTyrCorsOrigins)
            origins.Add("https://*.typingrealm.com");

        origins.AddRange(config.CorsOrigins);

        app.UseCors(builder =>
        {
            if (config.UseTyrCorsOrigins)
                builder = builder.SetIsOriginAllowedToAllowWildcardSubdomains();

            builder
                .WithOrigins(origins.ToArray())
                .AllowAnyMethod()
                .AllowCredentials() // Needed for cookies.
                .WithHeaders("Authorization", "Content-Type");
        });

        app.UseAuthentication(); // Mandatory to register AFTER CORS.
        app.UseAuthorization();

        // Add logout endpoint for removing the cookie.
        app.MapPost("/api/auth/logout", async (HttpResponse _, HttpContext context) =>
        {
            await context.SignOutAsync();
            context.Response.Cookies.Delete($"{config.AuthCookieName}_Info");
        })
            .WithTags("Authentication")
            .WithSummary("Sign out current user")
            .WithDescription("Signs out current user (removes the cookie) so you can sign in with a different login.")
            .RequireAuthorization();
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
