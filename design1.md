# Alternative Docs Implementation - Meta Description

The goal of this project is ultimately to generate a working alternative to Google Docs with the same functionality.

This is a meta-design document in that it's purpose is to help set up how Claude Code will be used to design the app, instead of actually specifying how the app is designed.

The output here should be any outputs mentioned below, documentaion of sufficient information to get started, and anything else that makes sense.

## Considerations

### Prompting Claude

A recent project claims to use the following loop to build a repo with Claude:

```
#!/bin/bash

while true; do
    COMMIT=$(git rev-parse --short=6 HEAD)
    LOGFILE="agent_logs/agent_${COMMIT}.log"

    claude --dangerously-skip-permissions \
           -p "$(cat AGENT_PROMPT.md)" \
           --model claude-opus-X-Y &> "$LOGFILE"
done
```

I want to make sure I understand what this does, particularly the logging so I can understand what is happening, and I want to know what a suitable AGENT_PROMPT.md is (an outline of AGENT_PROMPT.md is to be one of the outputs, a bash script to run Claude similarly to the above is to be another)

### Project Structure

What should the initial repo look like, incuding things like scratch space for documenting work in progress, new ideas, etc. The project I'm looking at as inpsiration has a `current_tasks` directory and `ideas` directory that are used to manage these. It's not clear how we bootstrap this to start off the repo so it can be improved with a loop like in the previous section

### Testing

What do we need to do to enable testing? Can Claude code automatically use a headless browser to test our app, or do we need to set up something externally? What won't we be able to test without additional harnesses? For example, securely sharing documents might require magic links, such as setup couldn't necessarily be tested from inside Claude code

### Where does the spec go?

What kind of input is needed in terms of a PRD or ideally more lightweight specification of features and priorities? Where would this go, and how does a human in the loop update it?

### How doe we ensure no cheating?

I want this to be a from-scratch implementation with minimal dependencies. How do we spec this out so we don't end up with a copy of some open source project, a wrapper around an existing web component that does most of what we want, or some other failure mode I haven't thought of.

### Autonomy

I imagine this being a big project that takes a long time, how do I minimize human in the loop to let Claude code run autonomously for a long time, while still being able to vet serious decisions and course correct. Maybe we need more interaction at the beginning while the spec is still being ironed out.

### What else?

What other considerations do we need?

## Notes

The plan is to run this on a dedicated VPS, and host a repo on github. As such there *shouldn't* be any concerns about doing anything "dangerous" - the worst that would happen if something goes wrong is the VPS instance is nuked, I'm fine iwith that. 


