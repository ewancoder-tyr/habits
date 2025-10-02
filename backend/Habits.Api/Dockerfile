ARG LAUNCHING_FROM_VS
ARG FINAL_BASE_IMAGE=${LAUNCHING_FROM_VS:+aotdebug}

# Fast debug.
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080

# Production build.
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
# Deps for native app.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    clang zlib1g-dev
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["Habits.Api/Habits.Api.csproj", "Habits.Api/"]
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
RUN dotnet restore "./Habits.Api/Habits.Api.csproj"
COPY . .
WORKDIR "/src/Habits.Api"
RUN dotnet build "./Habits.Api.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Pruduction publish.
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./Habits.Api.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=true

# Slow debug.
FROM base AS aotdebug
USER root
# Install GDB to support native debugging.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gdb
USER app

# Production final image.
FROM ${FINAL_BASE_IMAGE:-mcr.microsoft.com/dotnet/runtime-deps:9.0.2-noble-chiseled} AS final
WORKDIR /app
EXPOSE 8080
COPY --from=publish /app/publish .
ENTRYPOINT ["./Habits.Api"]
