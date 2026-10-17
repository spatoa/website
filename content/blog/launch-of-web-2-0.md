+++
title = "Launch of Web 2.0: The Second Iteration"
date = 2026-10-14
updated = 2026-10-17
description = "Announcing the second iteration of my personal website: embracing mid-2000s web aesthetics, lightweight static tech, and upcoming software experiments."

[taxonomies]
tags = ["meta", "web", "retro", "zola"]
+++

[center]Welcome to **Web 2.0**. The second iteration of my personal contribution to the Internet![/center]

### Why "Web 2.0"?

The name contains an intentional joke about the evolution of the web. If you remember version 1.0 of this site, I congratulate you; only I used it, and it was never shared very far. It served as an experiment to define my digital presence. Over time, that initial version accumulated the cliches of the actual modern "Web 2.0": sterile minimalism, uniform layouts, and negligible content caused by an uninspiring design process. The punchline of the launch is in the reversal: version 2.0 of my site moves backward toward the actual Web 1.0 era. I want to embrace the static site experimentation that existed before everything started to centralise into different platforms. Personally, the design is just a bit of fun, and a good excuse to try out some different ideas to add some nice set dressing around the writing content. 

This new iteration I am trying to make draws directly from mid-2000s web aesthetics, embracing character over the sanitized utility seen in most sites and apps. I am attempting to not adopt the flaws of that era, meaning no illegible fonts or line lengths stretched across modern desktop displays. The goal is a balance between legacy personality and modern readability and accessibility standards. The design will continue to evolve, and if you so please, you can track every update in the [Git repository of this site](https://git.lachlans.world/spatoa/website). Beware, there isn't many pretty pictures, and the code repository may only be appreciated by those who want to see the more technical side of the organised chaos I am trying to create.

### The Vibe and inner workings

To get that classic Internet Explorer-era look without dealing with bloated modern web junk, I rely on a small handful of tools to handle the heavy lifting so I can focus on the part I actually care about: writing my actual blog. In saying this, I am having an awful lot of fun designing this page, and haven't spent a whole lot of time writing because of it. The details of my fun stem from two main pillars of how I have setup my workspace.

The main pillar of my site is Zola, an open-source static site generator (SSG) written in Rust that turns Markdown into static pages with almost zero effort on my end after the actual writing is done. It uses Markdown files that are essentially normal text files with a few formatting symbols, which when using the right editor, can look and feel just like writing in a normal document editing suite. My goal is to spend as much time as possible writing these posts and as little time as possible babysitting a backend after all, so following the philosophy of an SSG, having the ability to focus on the content outside of making it look pretty and within the design language of the site, why not just have the computer do it for me? All the post processing of the text, such as the fonts, styling, and everything else around them just happen automatically. To add a header like the above for example, is simply adding three \#\#\# before a line of text. It is honestly very satisfying after it is setup, and I highly recommend all interested in something like this project to give it a go!

Since I don't have much interest in modern web development now, especially after seeing how fast frameworks changed during university (an assignment was broken due to an update that changed some behaviour we relied on...), I offload most of the routine coding grunt work in to LLMs using Agent harnesses. Although a topical conversation for another time, agents seem to me to be practical tools for getting the mechanical work out of the way, especially with said everchanging frameworks. Outside of that automation and Zola, the rest of the stack is custom: HTML, CSS, and vanilla JS, with the whole local environment pinned reproducibly using Nix flakes. My models of choice are currently the Gemini models, they came with a subscription I was already using for Google services, so why not take advantage of the benefits given by the ecosystem I seem to be stuck in? It has crossed my mind that relying on a single provider for a tool that I am currently using a lot of is seemingly like putting all your eggs in one basket, and for something that can flag an account and get it deactivated, it does beg for a little more caution than what I would trust with other model providers that have no such connection to other personal services, such as email or cloud storage. I will write about my experiences with trying and failing to get agents working with local models sometime soon, the success limited mostly by fiscal budgetary decisions...

### How will this one be different?

I plan to do a lot more with my website this time around. Rather than letting it sit idle indefinitely again, I want to use it as a home for my writing, of which I plan to do more of. A few specific things I would like to focus on are:

- Reticulum Network Stack: Write-ups on my experiences working with it in different little projects. It is a fascinating project, both technically and philosophically, and something that I think deserves much more attention than it gets outside of the niche communities.
- Homelab Tinkering: Notes, setups, and whatever practical results (or failures) come out of messing with my self-hosted infrastructure, including notes on the hardware I use, the software I run, and the pain it causes watching it fail just as I forget how I set it up.
- Niche Software Projects: Documentation and post-mortems for any other obtuse side projects I end up building, including the ones written in Rust, the ones where I try and make games, the ones that never make it further than a single flawed idea.
- Non-Tech Miscellaneous: I would also like to spend more time writing occasional reflections. I have many opinions on music, both that I listen to and create, that I will figure out how to work a techy component into somehow. I also have some notes written that do not fit into the otherwise neat technical box I seem to have built the expectation off.

I will continuously go back and update the content that I have written previously, I believe for the better. This is, after all, a website built by a person who is learning things as they go. I believe this will be an interesting choice, as the version history of my articles will be publicly available on the repository ([see the history of this file here!](https://git.lachlans.world/spatoa/website/commits/branch/main/content/blog/launch-of-web-2-0.md)), allowing anyone to go back in time to see how I've changed my mind over time. I hope that this transparency provides a level of trust, and accountability, that I believe is more important than ever. Beyond documenting personal growth, I hope to also provide inspiration to any readers to try doing things themselves, even if it isn't related to information technology in any capacity.

### What else?

Sometime in the near future, my CTF team will be making a little website to document our writeups for different CTF challenges that we partake in. Our serious team name is one that we picked by accident during our time in university, and have since stuck with for lack of a more creative choice. We are a team of 3 members, and while we have been dormant for some time, we will be getting into the swing of things soon. When the site is ready, you will be able to read the writeups at [our CTF team site](https://ctf.lachlans.world). Until then, enjoy the fun little "coming soon" page.

As for this site, I've wanted to add a little more than just words on a screen like last time, and so I have made some more interactive features. One of these is the arcade window on the home page. It is just running a classic starfield screensaver for now, but I will be swapping in more interactive bits soon. Another demo that is fairly unfinished, but still interesting is the audio deck, which I hope to add some of the music I make into when I bother exporting the files. In the meantime, enjoy the little pocket pet game. You can even install it as a progressive web app on your phone if you want [here](https://www.lachlans.world/pet)!

Thanks for reading, don't forget to bookmark this site! I'll be coming back to this as often as I can, and I hope to share all the different things I'm working on sooner rather than later. Here is a photo of a smaller version of myself, getting the first experience that would, in some form, lead to me building this website all those years later.

![Image of me using the family computer as a child](/images/mr_network.jpg)

*— Lachlan (`spatoa`)*
