---
title: "Thinking required... - part 1"
author: "Thyge S. Steffensen"
layout: post1
tags: ["Thinking required"]
---

Like almost every other developer, or person, right now, I'm getting my grasp on AI: how it can assist me and how I best use it. It's a bit daunting, often thinking it's going to replace me - and then what? ... But I don't think it will, not in the near future that is.

Seeing all these 'projects' created by AIs makes me wonder how they do it. What's their strategy and how do they use the tools? On another point, many of the projects seen in `r/SideProject` is clearly AI generated, and not too complex - some of them are quite impressive though. Either way, how do you apply AIs assisted development for existing, non-trivial, code bases? Or, how do you speed-up coding stuff you don't know how to do?

# The project

I have a side project like many others, which is mainly for me to try out stuff I cannot fit into my work - one of them is the use of AI. The side project consists of the typical backend + frontend situation, and theres a map on the frontend - this will be the focus. There is many awesome map providers, but they either cost money or are limited - what if I want to decide how the map feels and what if I want to download that map for potentiel offline app access? Well, I have decided to host my own tiling server, which is quite easy with [martin](https://martin.maplibre.org/), the vector tile server from [MapLibre](https://maplibre.org/) which also create the front-end component [MapLibre GL JS](https://maplibre.org/projects/gl-js/) I'm planing on using - and this all fits nice together.

Martin does not come with any data, this you have to provide yourself - I'm using [OpenStreetMap](https://www.openstreetmap.org/about) data which can be easily ingested using the [osm2psql](https://osm2pgsql.org/) tool.

The data flow loks like this:

![OpenStreetMap data flow](/assets/images/2026-04-11-map-data-flow.drawio.png)

# The problem

This works, and is awesome - but also terrible slow.
I have chosen to ingest the data into martin using the [OpenMapTiles Scheme](https://openmaptiles.org/schema/). This is important when creating the map styles, as they are based on the structure of the data in martin.
I choose this in the hope of benefiting of styles created by others and the hope to maybe share my style or make it "swappable".

Already, I have extended the scheme as some of the data I require does not fit - but I think that's fine.

The slow serving of map data is partly the hardware I'm running on, but I guess also the style I created and what data is actually loaded - requests at lower zoom levels is not too slow. Currently, data is loaded for the full schema, but not all features are used by the style. This means the database is larger than necessary. Another point is also the features/attributes shown at each zoom level, there are too many.

And lastly, this is a vector map which I think needs more resources than a tile map.

# The approach

I want to iterate on (1) what data is loaded into martin and (2) what details are shown at each level - to get a better performant mapping experience, hopefully without compromising too many details.

This takes time, it currently takes 6 minutes to import the data and another few minutes to spin op Martin and then manually playing around with [Maputnik](https://maputnik.github.io/) to refine the style sheets.

This is also something that have consumed a great deal of my Claude tokens - which could be used for other stuff.

My idea is instead to use a local llm, I have had great success with devstral-small-2, which is running fine on my M2 Pro 32G ram machine - not as fast compared with Claude + Opus 4.6, but this is with unlimited tokens.

Now, tying the preamble together with my problem: I have read quite a few mentions that benefitting from AI is about the workflow, make it clear how things fit together and what commands can be executed.

So, that's is what I want to try to do.

Create a workflow with a feedback loop for my AI to refine the themepark (`osm2psql` tool) configuration to load the minimum required data into martin, to support the MapLibre style to serve a map looking like I want. How hard can that be?

_Edit: The is not going to be the straight line I hoped, their might not be a easy to follow red line through these parts. But, how is reading it anyways_
