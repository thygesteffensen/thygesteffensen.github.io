---
title: "Automated Custom Connector (Power Platform)"
author: "Thyge S. Steffensen"
layout: post1
tags: ["Power Platform", "Custom Connector"]
---

As of writing this post and preparing the accompanying demonstration repository, I noticed that .NET 9 allows to serialize a `OpenApiDocument` as version 2 (also known as Swagger 2.0, aka. the version supported by Custom Connectors) - while Swashbuckle does not have support for that (from what I could see). Thus, the first iteration was an, successful but fragile, attempt to solve the problem using a varied selection of tools. This solution can be viewed in [this post](/2025/02/20/OpenAPI-30-Automated-Custom-Connector.html).

_Disclaimer: This is just one approach. One could also: use a package that will generate a Swagger 2.0 spec, instead of OpenAPI 3.0; or modify the generated OpenAPI 3.0 to be compatible with Custom Connector using the OOB features in Swashbuckle; or use another framework which still supports Swagger 2.0._

---

# Custom Connector?

> A custom connector is a wrapper around a REST API that allows Logic Apps, Power Automate, or Power Apps to communicate with that REST or SOAP API. [Source](https://learn.microsoft.com/en-us/connectors/custom-connectors/)

From my observations, it seems like a Custom Connector is a specification to configure a _managed_ API management instance, based on listed limitations:

> Custom connectors need to be imported first, before connection references or flows. [Source](https://learn.microsoft.com/en-us/connectors/custom-connectors/customconnectorssolutions)

and on limitions similar to those of API Management.

Given these limitations, and others, Custom Connector is still the best way to expose your REST API to the Power Platform + Azure Logic Apps.

However, manually editing the Custom Connector in the Custom Connector user-interface is a tedious and in my experience, an erroneous process.

The solution is to automate the process by using the generated OpenAPI document from our WebAPI to generate the Custom Connector.

## How to

1. Assign 'Operation ID's to all operations.
2. Generate a Swagger 2.0 version.
3. Merge the 'paths' with the existing Custom Connector specification.

### Assign 'Operation ID's to all operations.

_This examples uses Minimal APIs, so it's up to the reader to adapt it_

Operation ID taken from the endpoint name, which is configured by `.WithName("<endpoint-name>)"` [docs,](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis?view=aspnetcore-9.0#named-endpoints-and-link-generation) or it can be programmatically populated for all endpoints by walking the OpenApiDocument tree as:

```c#
// src/program.cs:13
builder.Services.AddOpenApi("cc", options =>
{
    options.OpenApiVersion = OpenApiSpecVersion.OpenApi2_0;
    options.AddDocumentTransformer((document, _, _) =>
    {
        PopulateOperationIds(document);

        return Task.CompletedTask;
    });
});
```
and
```c#
// src/program.cs:125
void PopulateOperationIds(OpenApiDocument openApiDocument)
{
    foreach (var (openApiPathItemKey, openApiPathItem) in openApiDocument.Paths)
    {
        foreach (var (openApiOperationKey, openApiOperation) in openApiPathItem.Operations)
        {
            var version = $"V{openApiDocument.Info.Version.AsSpan()[0]}";
            var path = openApiPathItemKey;
            var paths = openApiOperation.Parameters ?? [];
            path = Regex.Replace(path, @"\{[^}]*\}", "");
            path = path.Remove(0, 1);
            path = path.Split('/').Aggregate("", (acc, e) => acc + FirstCharToUpper(e));
            if (paths.Any())
                path = $"{path}By{string.Join("And", paths.Select(x => FirstCharToUpper(x.Name)))}";

            openApiOperation.OperationId =
                $"{FirstCharToUpper(version)}{FirstCharToUpper(openApiOperationKey.ToString())}{path}";
            continue;

            string FirstCharToUpper(string input) =>
                string.IsNullOrWhiteSpace(input)
                    ? ""
                    : input.First().ToString().ToUpper() + input.AsSpan(1).ToString();
        }
    }
}
```

This is just one way to populate the Operation ID. I find the name generation minimal and descriptive, while easily navigating to the correct endpoint which can then be explored further using a "Swagger UI".

I like generating the names, instead of manually creating them, to ensure consistency and traceability. An argument against this is that a tighter coupling between the API and the implementation in, for example, a Canvas Apps.

E.g., we change the path of a resource. `/todoes` becomes `/todoies` instead. This change can easily be implemented by just updating the Custom Connector, and the Canvas App remains untouched because the Operation ID remains the same. However, by generating the Operation ID, all uses of the operation must also be updated.

On the contrary, the OpenAPI spec can start to drift with regard to the relation between the path and the Operation ID - and end up not making sense.

But then again, changing the paths, query parameters and/or body scheme should be considered breaking, no matter the abstraction a consumer can implement.

### Generate a Swagger 2.0 version

There are two paths we can take, generating the OpenAPI document at build-time or run-time. Therese is configured in two different places.

#### Run-time

As already seen above, with configure the OpenAPI output to be Swagger V2 by `options.OpenApiVersion = OpenApiSpecVersion.OpenApi2_0;`, this tells .NET to serialize the OpenAPI as V2.
Above, we registered the document as `cc` (Custom Connector), this enables us to have multiple "versions" of the same document, and still output a OpenAPI 3.0 document. (We cannot "really" use any new features because the endpoint must be compatible with the Custom Connector...).

We then need to run our application to fetch the document.

#### Build-time

We enable .NET to emit the document on build by using the `Microsoft.Extensions.ApiDescription.Server` Nuget package, as [Source](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/aspnetcore-openapi?view=aspnetcore-9.0&tabs=visual-studio#generate-openapi-documents-at-build-time):
```csproj
<PackageReference Include="Microsoft.Extensions.ApiDescription.Server" Version="9.0.2">
    <PrivateAssets>all</PrivateAssets>
    <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
</PackageReference>
```

We need to configure the OpenAPI version in the `csproj` as well:
```csproj
<PropertyGroup>
   <OpenApiGenerateDocumentsOptions>--openapi-version OpenApi2_0</OpenApiGenerateDocumentsOptions>
</PropertyGroup>
```
The output location and which document to output can also be specified, according to the docs.

Now `dotnet build` will, in our case and configuration, emit two specs `src/WebApi/WebApi.json` and `src/WebApi/WebApi_cc.json`, both as Swagger 2.0 documents.

_It is a known [limitation](https://github.com/dotnet/aspnetcore/issues/60463) that the OpenAPI document is configured differently - and from the current state of things we cannot emit two different versions at build-time, only run-time._

### Merge the 'paths' with existing Custom Connector specification

The Custom Connector definition contains other details, probably different from the generated Swagger 2.0 spec. Most likely due to the "Security Definition" or host configured in the Custom Connector.

To make sure we do not overwrite any configuration configured in the Custom Connector in Power Platform, we only take the `paths` and `components` part of the generated document and overwrite in the existing Custom Connector.

This can be automated by using Power Platform CLI and `jq`, as:

```ps
# Trim generated OpenAPI document
jq 'del(.components.securitySchemes, .security)' src/WebApi/WebApi_cc.json > out/openapi-spec.json

# Download existing Custom Connector
pac connector download --connector-id $connectorId --outputDirectory out

# Trim Custom Connector api definition
jq 'del(.paths, .info, .definitions)' out/apiDefinition.json > out/base.json

# Merge thw two
jq -s '.[0] + .[1]' out/base.json src/WebApi/WebApi_cc.json > out/newApiDefinition.json

# Update Custom Connector
pac connector update --environment $environment --connector-id connectorId --api-definition-file out/newApiDefinition.json --api-properties-file out/apiProperties.json --icon-file out/icon.png
```
This script assumes both [Power Platform CLI](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction?tabs=windows) and [jq](https://jqlang.org/) are added to your path.

## Conclusion

With a few OoTB steps and the use of a first-party and trusted third-party tool, we can automate the process of maintaining a Custom Connector. A sample can be found [here](https://github.com/thygesteffensen/AutomatedCustomConnector).
