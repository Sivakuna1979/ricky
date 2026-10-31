"""Humanoid robot software stack (simulation-first).

Packages:
    core        - shared data types and the main Robot controller
    config      - loads robot-version configuration files
    hardware    - hardware interfaces + simulated and (future) real drivers
    simulation  - the virtual world the simulated robot lives in
    safety      - software safety controller (NOT a replacement for hardware safety)
    planning    - turns plain-English instructions into structured actions
    navigation  - path planning around obstacles
    dashboard   - browser control panel (works on Windows and iPhone)
    voice       - placeholder for English/Tamil speech (NOT IMPLEMENTED)
    integrations- placeholders for ROS 2 and other future systems
"""

__version__ = "0.1.0"
