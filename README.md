## Beard Swarm - Yet another distributed task runner

Initial goal is to run build jobs for large code bases with mulitple configurations.

Suitable as the basis for a continuous integration cluster, build cluster, or large data file scanner.

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
