+++
title = "Launch of Web 2.0: The Second Iteration"
date = 2026-10-14
description = "Announcing the second iteration of my personal website: embracing mid-2000s web aesthetics, lightweight static tech, and upcoming software experiments."

[taxonomies]
tags = ["meta", "web", "retro", "zola"]
+++

Welcome to **Web 2.0**. The second iteration of my personal contribution to the Internet!

### Why "Web 2.0"?

The name contains an intentional joke about the evolution of the web. If you remember version 1.0 of this site, I congratulate you; only I used it. It served as an experiment to define my digital presence. Over time, that initial version accumulated the cliches of modern "Web 2.0": sterile minimalism, uniform layouts, and negligible content caused by an uninspiring design process.

The punchline is in the reversal: version 2.0 moves backward toward Web 1.0. This new iteration draws directly from mid-2000s web aesthetics, embracing character over sanitized utility. I am not adopting the flaws of that era—illegible fonts or line lengths stretched across modern 16:9 displays remain excluded. The goal is a balance between legacy personality and modern readability. The design will continue to evolve, and you can track every update in the [Git repository of this site](https://git.lachlans.world/spatoa/website).

### How "Web 2.0"?

To get that classic Internet Explorer-era look without dealing with bloated modern web junk, I rely on a small handful of tools to handle the heavy lifting so I can focus on the part I actually care about: writing.

The main piece here is Zola, an open-source static site generator written in Rust that turns Markdown into static pages with zero effort on my end after the actual writing is done. My goal is to spend as much time as possible writing these posts and as little time as possible babysitting a backend.

Since I don't have much interest in modern web development beyond a few native standards like [WebComponents](https://developer.mozilla.org/en-US/docs/Web/API/Web_components), I offload most of the routine coding grunt work in Google Antigravity to the Gemini models. Although a topical conversation for another time, agents are practical tools for getting the mechanical work out of the way. Outside of that automation and Zola, the rest of the stack is custom: HTML, CSS, and vanilla JS, with the whole local environment pinned reproducibly using Nix flakes.

### What "Web 2.0"?

I plan to do a lot more with this site this time around. Rather than letting it sit idle, I want to use it as a home for a few specific things:

- Reticulum Network Stack: Write-ups on my experiences working with it. It is a fascinating project, both technically and philosophically.
- Homelab Tinkering: Notes, setups, and whatever practical results (or failures) come out of messing with my self-hosted infrastructure.
- Niche Software Projects: Documentation and post-mortems for any other obtuse side projects I end up building.
- Non-Tech Miscellaneous: Occasional reflections, music, and notes from time off that do not fit otherwise neat technical box.

As for the site itself, the arcade window on the home page is just running a classic starfield screensaver for now, but I will be swapping in more interactive bits soon. In the meantime, enjoy the pocket pet found on the other side of the page. You can even install it as an app on your phone if you want [here](https://www.lachlans.world/pet)!

Thanks for reading, don't forget to bookmark, I'll be coming back to this as often as I can!

*— Lachlan (`spatoa`)*
