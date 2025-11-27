---
title: "EasyAuth easy set-up"
author: "Thyge S. Steffensen"
layout: post1
tags: []
---

I had some trouble figuring out how to enable EasyAuth _and_ controlling which users/applications that could access the "EasyAuth'ed" "app".

I was following [this guide](https://learn.microsoft.com/en-us/azure/container-apps/authentication-entra) from Microsoft, which was a bit outdated and when finished, every User in my tenant could access my site and no application could access it.

Following this guide will:
- Enable Easy Auth for a Container App.
- Limit which users can access the Container App.
- Limit which applications can access the Container App.

In other words, give explicit access to users and/or applications to access a Container App. Notice that, Easy Auth is a all or nothing setup -- either you can access the app or you cannot.
If you want granulated control, for example to have a home site and expose API which have individual access requirements - I would use something like [Authentication and Authorization in ASP.NET Web API](https://learn.microsoft.com/en-us/aspnet/web-api/overview/security/authentication-and-authorization-in-aspnet-web-api).

Without testing, this guide might also work for App Services and Logic Apps, where "EasyAuth" is also availible.

# Spin up a container app

_I will follow this guide, and they try to set it up on a real set-up afterwards_

Let's start by spinning up container app using the 'Quick start image' or `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest` and remember to enable 'Ingress' from everywhere.

Et voila - we got a site which we can access following the url yielding:

![Web capture showing hello world container app](/assets/images/2025-11-27-hello-world.png)

And the following simple .NET Console App:
```csharp
var httpClient = new HttpClient();
var resp  = await httpClient.GetAsync("https://ca-easyauth-setup-we-01.whitecoast-ef2c042a.westeurope.azurecontainerapps.io/");
Console.WriteLine(resp.StatusCode);
```
will output:
```bash
$ dotnet run
OK
```

So far, we have a Container App - which everybody can access. Not good for a non-public API ;)

# Create an App Registration (Container App)


1. Let's create a App Registration representing the Container App.
   ![New app registration](/assets/images/2025-11-27-new-app-reg.png)
2. Go to 'Manage > Authentication (Preview)' and under the 'Settings' tab, enable 'ID tokens (used for implicit and hybrid flows)'.
      ![Enable ID tokens](/assets/images/2025-11-27-authentication-settings.png)
3. Go to 'Manage > Expose an API' and add 'Application ID URI'
4. Go to 'Manage > App roles' and add 'Create app role', give it a name and select 'Both'.
   ![App registration app role creation](/assets/images/2025-11-27-app-role.png) 
5. Go to 'Manage > API permissions' and grant 'Microsoft Graph (1) > User.Read'
   ![Grant admin consent to Microsoft Graph User.Read permission](/assets/images/2025-11-27-grant-admin-consent.png)
6. Go to 'Overview' and access the underlaying 'Managed application in local directory'.
7. In the 'Enterprise Application' go to 'Manage > Properties' and enable 'Assignment required?'. This will block internal users access.
   ![Enable Assignment Required for Enterprise Application](/assets/images/2025-11-27-enterprise-app-assignment-required.png)

# Configure Easy Auth 

1. Go back to the Container App.
2. Go to 'Security > Authentication'.
3. Add 'Add identity provider' and select 'Microsoft' as the 'Identity provider'.
   1. Select'Pick an existing app registration in this directory' and select expiry.
   2. Enable 'Allow requests from any application (Not recommended)'. This is okay, because we enable 'Assignment required?' in the 'Enterprise Application'.
      ![Container App Authentication set-up](/assets/images/2025-11-27-container-app-auth-set-up.png)
   4. Save and edit to set audience which is the 'Application ID' under ''Mange > Expose an API' from above (Yes... according to this should be default, but it need to be explicit...).
      ![Container App Authentication](/assets/images/2025-11-27-container-app-authentication.png)
   5. Press 'Add' and wait - now neither a User or Application can access the Container App.

Now we get and 
```bash
$ dotnet run
Unauthorized
```

# Give access to Users

1. Go to the 'Container App's 'Enterpise Application and add a user or group under 'Manage > Users and groups'.

# Give access to Applications

1. Create a new 'App Registration' representing the daemon application.
2. Go to 'Mange > API Permissions' and press 'Add a permission' and assign the Container App App registrion role (It's hidden under 'APIs my organization uses').
   Select 'Application permissions' and select 'Api.Access'
   ![Daemon application app role assignment](/assets/images/2025-11-27-app-role-assignment.png)
3. Grant permission.
4. Get details to get a token using the App Registration.

Now using the below simple Console App:
```csharp
// From 'Azure.Identity' NuGet package
var provider = new ClientSecretCredential(
    tenantId: "8ff96c2c-****-****-****-************",
    clientId: "eed2eb09-5d39-4ff6-a214-f6ff72be5d87",
    clientSecret: "****************************************");

var token = provider.GetToken(new TokenRequestContext(["api://2c69314f-a545-4678-a70d-584357f0bc84/.default"])).Token;

var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token);

var resp  = await httpClient.GetAsync("https://ca-easyauth-setup-we-01.whitecoast-ef2c042a.westeurope.azurecontainerapps.io/");
Console.WriteLine(resp.StatusCode);
```

will yeild:
```bash
$ dotnet run
OK
```

# Recap

Now, we have enabled authentication for our Container App, and explicit grant access to users or applicaitons.

# Gotcha

- Not enabling 'Assignment required?' will make all users in the tenant able to access the app.
- Enabling 'Allow requests from any application (Not recommended)' will make.