---
title: "Thinking required... - part 2"
author: "Thyge S. Steffensen"
layout: post1
tags: ["Thinking required"]
---

Continuing from [Part 1]({% link 2026-04-12-Thinking-required.md %})

Alright, the plan is to: Get the local llm to be able to spin up a new martin instance, load data into it, and benchmark how it generates a part of the map - reflecting on that and make it quicker. Then to ensure the output is as I want, it should capture the map and compare it with an expected output (which I kinda of have).

Luckily, I have experience with devstral-small-2, which supports both text and image (and tools).

# The workflow.

- Adjust data seeded in the database by the themepark script used by `osm2psql`.
- Start a fresh PostGIS instance and seed data.
- Adjust the map style to fit with the data structure.
- Evaluate rendered map and performance.
- Evaluate, refine and start over.

Maybe this is also a good time to get experience with a MCP server? (We'll get back to this question later ;))

## Loading data

I already have a pipeline to process OpenStreetMap data and load into Martin using the themepark 'plugin'. This have been nicely wrapped in a Dockerfile so it can be started using docker.

Spinning up the database, martin and seeding data is all done with simple docker compose commands.

## MCP / Tools

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) is a protocol designed to enable _AIs_ to discover _tools_ and interact with them. It's _basically_ a wrapper of JSON-RPC. This is designed by Antropic. This seems awesome, and it is - but I'm not sure it is usefull yet.

I have played around with Claude, Codex and Cursor a fair bit, and I think I developed some a-okay workflows for myself. Though, I have never gotten to that point where I start something and let it sweat over it for hours, like others have. I have usually given it tasks which I would follow up on relatively fast, suchs as extended my unit tests and the like.

I'm currently in a position where I cannot use any cloud hosted services, including models. This got me to look into local llms, thinking it couldn't be that hard. One evening getting all excited about how easy it is to get started, and naively thinking that my Lenovo Intel Ultra 7 165 H, 32 GB, Intel AI Boost, Inel Arc Pro 18 GB shared and NVIDIA RTX 500 Ada Gen with 4 GB dedicated memory was good. Well, it could run qwen2.5-coder:7b alright, with a 4k context - this works fine for chatting, but for coding it was no good.

Some exploration later, I gave up on running any coding related tasks on my work pc - dreaming about getting a Mac Studio with 128 GB shared RAM. Well, I got my PC which is fairly decent with a M2 Pro and 32 GB, this can more easily run a devstral-small-2:24b with 32k context - occupying 21 GB of my RAM - not much left to other stuff...

> Fun note: Asking my local devstral to "tell a developer joke" delivers the _Why do programmers always mix up Halloween and Christmas?_ consistently, with different emojis.

This is also the driver for looking into running models locally, and to avoid using all my tokens right away. I found the easiest getting started was using [ollama](https://ollama.com/). `$ ollama pull <model>` and `$ ollama run <model>` (the pull not even being necessary) and you can chat with any model you desire - if you got the resources. This also spins up a OpenAPI compliant endpoint which makes it useful with [OpenCode](https://opencode.ai/) - and Claude and the rest of the gang.

This worked great! I get it working, got my local setup to analyze my current code base and make it iterate over creating a plan. During this, I discovered that if the model runs out of context, it tends to output the tool command instead of getting it executed. So, the chat ends with a peice of json, that should have resulted in something being done on the file system.

I was ready to let my AI work, but I didn't want it to stop halfway through, waiting for me to re-prompt a "continue". So, back to reading and recalling what I have seen/heard other have done: I need an AI (or tool) to start my AI worker. In other words, if I can create a loop to start an AI worker to do a sub task, and keep that going until it's done, it should be able to just continue.

But how do you do that? I started with naively asked Claude for help, it quickly gave me the following:

```sh
while true; do
  response=$(ollama run devstral-small-2:24b "$(cat orchestrator_prompt.md plan.md context.md)")

  if echo "$response" | grep -q "RUN_TASK:"; then
    task_file=$(echo "$response" | grep "RUN_TASK:" | awk '{print $2}')
    ollama run devstral-small-2:24b "$(cat worker_prompt.md $task_file)" > output/result_$(date +%s).md
    # Tell orchestrator to update plan + context
  elif echo "$response" | grep -q "DONE"; then
    echo "All tasks complete"; break
  fi

  sleep 2
done
```

A seemingly well put together shell scripts, that will keep going iterating through tasks and update a persistent plan and context while doing so. If you a quick, you might already know that ollama doesn't call tools out of the box, it just prints the output.

So I basically have a system, that will keeping doing stuff, but never update any files. Not to efficient if I want it to code.

So here I am - 3 hours in on a Sunday and I need to start prepping lunch for the next week. I have done a lot, written plans and iterating tasks and thinking about workflows. Now, I just need to figure out how to orchestrate my local llms in the "orchestrator/worker pattern" as Claude calls it.
