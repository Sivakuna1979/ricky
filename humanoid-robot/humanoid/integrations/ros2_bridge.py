"""ROS 2 bridge.  *** NOT IMPLEMENTED ***

ROS 2 (Robot Operating System 2) is the industry-standard robotics framework.
It runs best on Ubuntu Linux (on Windows: inside WSL2 or on a separate
Ubuntu mini-PC / Jetson on the robot).

Plan (Stage 4 of docs/ROADMAP.md):
  * Publish robot pose on /odom and /tf, battery on /battery_state.
  * Subscribe to /cmd_vel and route it THROUGH SafetyController.limit_velocity.
  * Implement DriveBase/Arm/Camera interfaces using ROS 2 topics/actions
    (ros2_control, MoveIt 2 for arms, Nav2 for navigation).
  * Keep the dashboard and task planner unchanged - they only use the
    hardware interfaces in humanoid/hardware/interfaces.py.
"""


class Ros2Bridge:
    available = False

    def start(self):
        raise NotImplementedError("NOT IMPLEMENTED YET: ROS 2 bridge (Roadmap Stage 4).")
