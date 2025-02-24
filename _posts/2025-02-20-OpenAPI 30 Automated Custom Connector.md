---
title: "OpenAPI 3.0 automated Custom Connector"
author: "Thyge S. Steffensen"
layout: post1
tags: ["Power Platform", "Custom Connector"]
---
# OpenAPI 3.0 automated Custom Connector

This was the first iteration of automating a Custom Connector. The WebAPI was initial build in .NET 8 and used [Swashbuckle](https://github.com/domaindrivendev/Swashbuckle.AspNetCore) to generate and expose the OpenAPI document as OpenAPI 3.0.

While writing [Automated Power Platform Custom Connector]({% post_url 2025-02-14-Automated-Power-Platform-Custom-Connector %}) and constructing a demonstration, I discovered that OpenAPI support in .NET 9 supported outputting the OpenAPI document as Swagger 2.0, both run-time and build-time.

However, some might be "stuck" on .NET 8 until the next LTS, or they might only get a OpenAPI 3.0 document from a vendor, then this method will work!

## The script
_... which can easily be converted to any pipeline language_.

The automation uses the following tools:
* `pac` [Power Platform CLI](https://learn.microsoft.com/fr-fr/power-platform/developer/cli/introduction)
  To download and update Custom Connector, and publish a solution.
* `jq` [Command-line JSON processor](https://jqlang.org/)
  Miscellaneous JSON modifications.
* `swagger` [go-swagger](https://goswagger.io/go-swagger/)
  To expand `$ref`, which is not fully supported in Custom Connector.
* `api-spec-converter` [api-spec-converter](https://github.com/LucyBot-Inc/api-spec-converter)
  Most import, to convert from OpenAPI 3.x to Swagger 2.0.

Compared to the .NET 9 version, this uses two tools to modify and convert the OpenAPI document, while using the same method to populate the Operation ID, but [slightly modified](#modified-operation-id).

```ps1
<#
    Endpoints must have the following:
        - OperationdId: Required to identify the operation in the Custom Connector, this is the name used in Power Apps
        - Summary: Omitting generates a warning
        - Description: Omitting generates a warning
    Custom Connector does not support oneOf, anyOf or similiar - this is removed by expanding the schema, because
    input/output with inheritance genreates defintions with oneOf.

    The apiDefintion.json must have host, basePath and schemes set.
    Not including the apiPropeerites.json, resets the colour - what else is reset when omitting?

    Tools:
        - pac (Power Platform CLI: https://docs.microsoft.com/en-us/power-platform/developer/data-integrator/pac-get-started)
          To retrive and update Custom Connector and publish changes.
        - jq (jqlang: https://stedolan.github.io/jq/. `brew install jq` or `winget install -e --id stedolan.jq`)
          To manipulate json files, remove objects and merge files.
        - api-spec-converter (https://www.npmjs.com/package/api-spec-converter. `npm install -g api-spec-converter`)
          To convert between openapi and swagger.
        - swagger (go-swagger: https://goswagger.io/go-swagger/. `brew tap go-swagger/go-swagger && brew install go-swagger` or `docker? wsl?`)
          To flatten the swagger file, i.e. "removing" $refs and the use of `oneOf`.
#>

# You need to be logged in in `pac` before running this script - `pac auth create`
$connectorId = "<some-guid>" # The guid - Use `pac connector list` to get the guid
$environment = "https://<org>.crm4.dynamics.com" # Use `pac env list` to get the URL
#$openApi = "https://dev.azurewebsites.net/swagger/v2/swagger.json" # The open api url
$openApi = "https://localhost:5100/swagger/v2/swagger.json" # The open api url

New-Item -ItemType Directory -Path out

# Prepare base from existing connector to keep settings
pac env select --environment $environment
pac connector download --connector-id $connectorId --outputDirectory out

jq 'del(.paths, .info)' out/apiDefinition.json > out/base.json

Remove-Item out/apiDefinition.json

# Get and create new apiDefinition
curl $openApi -o out/openapi-spec-1.json

jq 'del(.components.securitySchemes, .security)' out/openapi-spec-1.json > out/openapi-spec.json

api-spec-converter --from=openapi_3 --to=swagger_2 --syntax=json out/openapi-spec.json > out/apiDefinition0.json

# Too complex with PowerShell...
jq -s '.[0] + .[1]' out/base.json out/apiDefinition0.json > out/apiDefinition1.json

swagger flatten out/apiDefinition1.json -o out/apiDefinition.json --with-expand --with-flatten remove-unused

jq 'walk(if type == "object" and has("allOf")
         then reduce .allOf[] as $item ({}; . * $item) | del(.allOf)
         else . end)' out/apiDefinition.json > out/apiDefinition-merged.json

# Upload
pac connector update --environment $environment --connector-id $connectorId --api-definition-file out/apiDefinition-merged.json --api-properties-file out/apiProperties.json --icon-file out/icon.png

# For good measure
pac solution publish

Remove-Item out -Recurse -Force
```

### OpenAPI 3.0 to Swagger 2.0

This is done with `api-spec-converter`. It did a good job, but it did not create a version compatible with Custom Connectors. The schemes/definitions for input and output was too complex, had to many layers and consisted of `anyOf`, `allOf` and `oneOf`. These are not supported in a Custom Connector and some of them could be removed by simplifying the endpoint in .NET. E.g., by not accepting complex, inherited, types as the body definition.

But even after that, the definitions in the OpenAPI document still consisted of multiple layers, i.e. `$ref` containing `$ref` and so on. This was solved by flattening the schema and removing all `$ref` and all definitions with `swagger flatten`.

Now, I discovered that when a body definition was a C# type that extended a base type, the definition in the OpenAPI document consisted of an `allOf` of the two types — where it should just be a union of the two. This was solved by merging all such instances with `jq`.


# Conclusion

That's about it. This solution is not perfect, and probably still needs some work with undiscovered edge cases, but we had a fairly advanced API which it supports.

# Modified Operation ID

This is the version that can be used with Swashbuckle.
```csharp
services.AddSwaggerGen(options => { options.CustomOperationIds(x => x.ToFriendlyString()); });
```
```csharp
public static string ToFriendlyString(this Microsoft.AspNetCore.Mvc.ApiExplorer.ApiDescription apiDescription)
{
    var version = apiDescription.GroupName!;
    var path = apiDescription.RelativePath!;
    var paths = apiDescription.ParameterDescriptions.Where(x => x.Source == BindingSource.Path);
    path = Regex.Replace(path, @"\{[^}]*\}", "");
    path = path.Remove(0, version.Length + 1);
    path = path.Split('/').Aggregate("", (acc, e) => acc + e.FirstCharToUpper());
    if(paths.Any())
        path = $"{path}By{string.Join("And", paths.Select(x => x.Name.FirstCharToUpper()))}";
    var opId = $"{version.FirstCharToUpper()}{apiDescription.HttpMethod!.ToLower().FirstCharToUpper()}{path}";
    return opId;
}
```
