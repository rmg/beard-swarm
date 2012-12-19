## BC3 - Build Clsuter v3

A re-design and re-write of BC2 in JavaScript using NodeJS.

Generally speaking, BC2 is a distributed task runner where a node connects to a job queue, performs a job, and uploads the results.


### TODO:

- Run a build
  - requires a description language/format
  - run commands, capture output
  - output capture should be "live"
    - event listeners can be turned on/off without ill effect!
- display state of running system
  - list running tasks
  - list details of specific running task
  - stream live output of selected task to client
    - websockets?
