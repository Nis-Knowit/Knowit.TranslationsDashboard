# Building and Publishing the Package

## Building the NuGet Package

### Prerequisites
- .NET 8 SDK
- NuGet CLI

### Steps to build the package

1. Navigate to the project folder:
```
cd Knowit.TranslationsDashboard
```

2. Build the project:
```
dotnet build --configuration Release
```

3. Create the NuGet package:
```
dotnet pack --configuration Release
```

This will create the NuGet package in the `bin/Release` folder.

## Publishing the Package to NuGet

1. Get your NuGet API key from nuget.org

2. Push the package to NuGet:
```
dotnet nuget push bin/Release/Knowit.TranslationsDashboard.1.0.0.nupkg --api-key YOUR_API_KEY --source https://api.nuget.org/v3/index.json
```

## Publishing to Umbraco Marketplace

1. Ensure your package meets all the requirements in the umbraco-marketplace.json file
2. Submit your package for review via the Umbraco Marketplace submission process
3. Update documentation and screenshots as needed

## Package Components

- `Controllers/KnowitTranslationsApiController.cs`: Main API controller for handling dictionary operations
- `App_Plugins/KnowitTranslationsDashboard/`: Contains all frontend files
  - `dashboard.html`: Main dashboard view
  - `KnowitTranslationsDashboard.controller.js`: Angular controller
  - `package.manifest`: Package configuration
  - `create.html`, `edit.html`, `editAll.html`: Dialog views
  - `lang/`: Language files

## Making Changes

When making changes, increment the version number in:
1. Knowit.TranslationsDashboard.csproj
2. umbraco-marketplace.json
3. Knowit.TranslationsDashboard.nuspec

## Testing

Test your package in a fresh Umbraco installation by installing it via NuGet:

```
dotnet add package Knowit.TranslationsDashboard --version 1.0.0
```