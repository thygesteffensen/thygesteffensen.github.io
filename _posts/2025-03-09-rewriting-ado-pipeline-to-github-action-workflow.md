---
title: "Rewriting Azure DevOps pipeline to GitHub Actions workflow"
author: "Thyge S. Steffensen"
layout: post1
tags: []
---

<!-- #{{ page.title }} -->

As a consultant within the Microsoft stack, most of the code is hosted in Azure DevOps repositories and we'll use Azure DevOps Pipelines as the CI/CD pipeline.

Well, what if it should be hosted in GitHub instead, and use GitHub Actions? I've use GitHub Actions for my own stuff and during my studies, so how hard can it be to convert a Azure DevOps pipeline to a GitHub Actions workflow?

I'll go through the Azure DevOps pipelines, or just pipelines, for [XrmBedrock](https://xrm.dev) and convert them to GitHub Action workflows, or just workflows.

## GitHub Actions? Azure DevOps Pipelines?

They are basically the same, and now both developed by Microsoft. They are a workflow/pipeline language and runtime, where "developers" can write defintion which will be executed in the runners. This is a way to basically execute shell commands, to build, test and deploy software - and possible way more!

Both are writing using `yaml` (Yet another markup language) and are quite similiar and almost identical feature set, for our scope at least. This is also comparable to GitLab CI/CD.


## The Pipelines

[XrmBedrock](https://xrm.dev) is the replacement for [XrmFramework](https://github.com/delegateas/XrmFramework), both of which are a framework/opinoted steup to work with plugins and web-resources with Power Apps. XrmBedrock is extended with support for working with Azure Functions in regards to Power Apps.

As many other projects, we have two pipelines: (1) Build and Test and (2) Deploy. The Power Apps stuff are intermingled with Azure stuff, to streamline deployment - I'm going to focus on the Power Apps part today.


## Build and Test

The `Build.yaml` pipeline is a great starting point, it uses `templates` which is a way to "generalize" pipeline definitions and make them reuseable. GitHub has the same, called [workflow template](https://docs.github.com/en/actions/writing-workflows/using-workflow-templates) and is a bit different. But there is also [two other alternatives](https://docs.github.com/en/actions/sharing-automations/avoiding-duplication) with two alternatives: (1) Reuseable workflows and (2) Composite actions. 

Workflow template cannot be in the same repository and they are a bit more tricky for our use case. They are better suited to create org-wide "reusable" actions - which is not what we are looking for. Let's focus on the two other alternatives.

Composite actions are like `microsoft/action-python`, and the steps within the action is not logged, making it difficult to narrow down a potentiel error since the 'Build and Test' workflow both generates contexts, builds and runs tests (and maybe more). However, Reusable workflows is a bit more similiar to how templating works in Azure DevOps. 

However, there is a major difference. In Azure DevOps, templates are injected and "expanded" when running the pipeline, which gives the flexibility to "template" the first n-steps and the add other steps in the same job. But in GitHub, a re-useable workflow is an entire job and this does not give the "freedom" to extend a job with additional steps. Remember, each job is executed in a new container and does not have the state of the previous job's steps.

Let's first create the `BuildSteps.yaml`. In GitHub, re-useable workflows have a trigger and here we can define inputs, just as `parameters` in Azure DevOps.

```yaml
name: Build and Test steps

on:
  workflow_call:
    secrets:
      CLIENT_SECRET:
        required: true
```

The `jobs` part is similiar, and here we define which runner we will use. GitHub does not automatically checkout the repository as in Azure DevOps.

```yaml
...
jobs:
  buildandtest:
    runs-on: windows-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: 8.x

      - name: Restore dependencies
        run: dotnet restore
...
```

So far so good, now we need to execute some of the F# scripts. These are targetted .NET Framework and we cannot use `dotnet fsi`. We must use the `fsi.exe` bundled with Visual Studio. To our luck, Visual Studio comes pre-installed on the [windows runner](https://github.com/actions/runner-images/blob/main/images/windows/Windows2022-Readme.md#visual-studio-enterprise-2022).

To make the workflow more readiable, we can save reused paths and more in the job environment:

```yaml
...
  buildandtest:
    runs-on: windows-latest
    env:
        FSI_PATH: 'C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\FSharp\Tools\fsi.exe'
        DAXIF_PATH: 'Dataverse/Tools/Daxif'

      - name: Update C# Context
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/GenerateDataverseDomain.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'
...
```

Now we have our re-useable workflow, stored in `.github/workflows/build-and-test.yaml`, on it can be seen just below or in the [pull request]().


<details>
<summary>`build-and-test.yaml`</summary>
<pre>
```
name: (child) Build and Test job

on:
  workflow_call:
    inputs:
      SYNC:
        required: false
        type: boolean
    secrets:
      CLIENT_SECRET:
        required: true

jobs:
  buildandtest:
    runs-on: windows-latest
    environment: dev
    env:
        FSI_PATH: 'C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\FSharp\Tools\fsi.exe'
        DAXIF_PATH: 'src/Tools/Daxif'
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: 8.x

      - name: Add signtool.exe to path for build
        run: |
          $signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\" `
                        -Recurse -Filter signtool.exe `
                        | Where-Object { $_.FullName -match '\\x64\\' } `
                        | Sort-Object LastWriteTime -Descending `
                        | Select-Object -First 1 -ExpandProperty DirectoryName
          if (-not $signtool) {
            throw "signtool.exe (x64) was not found!"
          }
          echo "PATH=$signtool;${{ env.PATH }}" | Out-File -FilePath $env:GITHUB_ENV -Encoding utf8 -Append
          echo "Located signtool at: $PATH"

      - name: Setup Node 18
        uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Restore dependencies
        run: dotnet restore

      - name: Update C# Context
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/GenerateDataverseDomain.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'

      - name: Update TS Context
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/GenerateTypeScriptContext.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'
        
      - name: Update test metadata
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/GenerateTestMetadata.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'

      - name: Build solution
        run: 'dotnet build --no-restore --configuration release'

      - name: Run tests
        run: 'dotnet test --no-build --configuration release'
        
      - name: Sync plugins
        if: ${{ inputs.SYNC == true }} 
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/PluginSyncDev.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'

      - name: Sync web resources 
        if: ${{ inputs.SYNC == true }} 
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/WebResourceSyncDev.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'
        
      - name: Publish DAXIF artifact
        if: ${{ inputs.SYNC == true }} 
        uses: actions/upload-artifact@v4
        with:
          name: daxif
          path: ${{ env.DAXIF_PATH }}

```
</pre>
</details>


The `Build.yaml` Azure DevOps pipeline uses `trigger: none` and `pr: master`, which means it only runs on pull requests. We can do the same in GitHub.

> NOTE:<br>
> `workflow_dispatch:` is used to trigger a workflow from the UI!

```yaml
name: Build and Test

on:
  pull_request:
    types:
      - opened
      - synchronize
    branches:
      - main

jobs:
  buildandtest:
    uses: ./.github/workflows/build-and-test.yaml
    environment: dev
    secrets:
      CLIENT_SECRET: ${{ secrets.CLIENT_SECRET }}
```

I have create an 'Environment', `dev`, with the `CLIENT_SECRET` as a secret and `DATAVERSE_APP_ID` as a variable. A similiar envionment can be created for the test environment. These can also be set up as a 'guard'.


## Deploy

Let's continue with the deploy pipeline, with focus on Power Platform. The Azure DevOps pipeline is constructed with a lot of templates, where many only are used once. I find it easier to read pipelines when they don't have too many levels of templating.

So, the GitHub Actions version will be a bit different and we can always refactor it to reuseable workflows when the workflows are too big and the need arises.

To deploy we must first perform some actions to create the "deployment package", which is deployed upstream. 

We must: (1) build plugins and webresources, (2) sync them to the Power Platform environment, (3) Publish the changes and (4) export the solution, which is a "dployment package".

The pipeline uses "artifacts" to share the "dployment pacakge" with later stages, and GitHub Actions has the same concept, _artifacts_.

Jobs in GitHub Actions don't share 'context'. I.e., build created in a job is not avaible in a following job, just like in jobs and stages in Azure DevOps. So, our `build-and-test.yaml` already builds and tests as we need, but the work is gone when the job ends. 

This is not a problem in Azure Devops, due to how it handles templating. To work around this, we extend `build-and-test.yaml` with the steps dependant or the build "work" using `if` and a new input `SYNC`:

```yaml
...
      - name: Sync plugins
        if: ${{ inputs.SYNC == true }} 
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/PluginSyncDev.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'

      - name: Sync web resources 
        if: ${{ inputs.SYNC == true }} 
        run: '& "$env:FSI_PATH" $env:DAXIF_PATH/WebResourceSyncDev.fsx /mfaAppId="${{ vars.DATAVERSE_APP_ID }}" /mfaClientSecret="${{ secrets.CLIENT_SECRET }}" /method="ClientSecret"'
```
_The 'auth' parts is not a "variable", when running `& "$env:FSI_PATH" $env:DAXIF_PATH/WebResourceSyncDev.fsx $env:AUTH_PARAMS` the parameters was not expanded properly and thus not parsed correctly into the script._

This way, we can divide our work into three+ jobs: (1) Build, test and sync, (2) Publish and create package and (3) deploy to the different environments. And, we can use `build-and-test.yaml` when validating pull requests, wihtout syncing.

Only part (1) needs to codebase, so we can speed it up by avoiding to checkout the repository in part (2) and (3). However, part (2) and (3) needs Daxif and the scripts, so we upload them as an artifact in `build-and-test.yaml`.

To finish the sync of plugins and web-resources and finish the deploy, we must Publish the changes in Power Platform. The Azure DevOps pipelines uses the `PowerPlatformToolInstaller` task to setup "Power Platform Build Tools", in GitHub actions we can use the `microsoft/powerplatform-actions/actions-install@v1` action. However, the "Power Platform Build Tools" is just a [wrapper](https://github.com/micrsoft/powerplatform-build-tools) for `pac` (Power Platform CLI), which can be installed as a dotnet tool with `dotnet tool install Microsoft.PowerApps.CLI.Tool`.

I prefer avoid the wrapper and using the CLI tools plain. I'm more likely to be familiar with the CLI tools compared to the _tasks_ and I find it easier to read and understand pipeline. In addition, it is easier to "execute" the pipeline locally step-by-step and try it out - which also makes it easier to write pipelines.

> NOTE:
> Using tasks such as `actions/setup-dotnet@v3` or `actions/checkout@4` makes good sense, since they interact with the runner in a different way. E.g., setting environment variablesm, installing dependencies or performing I/O actions.

## Conclusion

We have converted the Power Apps part of the XrmBedrock Azure DevOps pipelines to GitHub Actions. The entire code can be seen in this [pull request](https://github.com/delegateas/XrmBedrock/pull/9) and it should not be dificult to extend these with support the Azure part also.

For this use case, GitHub Actions is feature comparible with Azure DevOps pipelines and are just as easy/deficult to work with.


## Miscellanous

To make a quicker feedback loop, I ended up creating a few small workflows to test everything out and play around woth workflows.

### Sample `fsi.exe` test workflow

```yaml
name: F# Interactive Test

on:
  workflow_dispatch:

jobs:
  test-fsi:
    name: Test F# Interactive (fsi.exe)
    runs-on: windows-latest

    steps:
      - name: Locate FSI.exe
        id: find-fsi
        shell: pwsh
        run: |
          $fsiPath = "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\FSharp\Tools\fsi.exe"
          if (Test-Path $fsiPath) {
            echo "FSI.exe found at $fsiPath"
            echo "FSI_PATH=$fsiPath" | Out-File -Append -Encoding utf8 $env:GITHUB_ENV
          } else {
            echo "FSI.exe not found!"
            exit 1
          }

      - name: Create F# Test Script
        run: echo 'printfn "Hello from FSI!"' > test.fsx

      - name: Run F# Script using FSI.exe
        run: '& "$env:FSI_PATH" test.fsx'
```