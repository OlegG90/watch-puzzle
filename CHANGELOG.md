# Changelog

Versions follow [Semantic Versioning](https://semver.org/). Each release has a tag and a [GitHub release](https://github.com/OlegG90/watch-puzzle/releases).

## 0.2.0

- Add Expert, a third level: fit every part and oil 19 points with the right one of four oils. A wrong oil is refused and explained, and a part that would cover an unoiled point is refused. Hints cover oiling. Expert has its own save and records.
- Hold a finger on the movement in Expert to see a magnifier, which marks the point it would oil.
- Show arrows at the edges of the parts tray when more parts lie beyond. Tapping one scrolls the tray.
- Draw larger parts larger in the tray, so a screw no longer looks as big as the case.
- Hide the screwdriver in Apprentice, where screws tighten themselves.
- The Continue button no longer appears for a game with nothing done.
- A screwdriver left active by the previous game no longer stays highlighted.
- The view resets before winding, so a zoomed view cannot hide the dial.

## 0.1.4

- Fix the test command on Node 22, which stopped the release workflow.
- The first version published by the release workflow, including everything in 0.1.3.

## 0.1.3

Released but never published to the site, because the release workflow failed.

- Show the version and a link to the GitHub repository in the menu.
- Show the back of the watch in the menu.
- The View button now opens a picture of the back of the watch, with a separate button to reset the view. It used to do nothing visible unless the view had been moved.
- Start versioned releases. The site now updates only when a release is published.

## 0.1.2

The first tagged release.

- Assemble a pocket watch in 3D: Master has 57 parts, Apprentice 24.
- Touch targets chosen in screen space, so small parts are easy to hit. Parts can be tapped into place or dragged.
- A finished watch that runs on true gear ratios and shows the real time.
- English and Ukrainian, with English as the default.
- Reference pictures of the movement.
- Installable web app that plays offline.
