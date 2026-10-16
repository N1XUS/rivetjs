---
title: Sign in
description: "Sign in and sign up on one screen, with a password strength meter, a reset-link flow and a one-time code step."
template: guide
status: experimental
related: [components/form, components/input-group, components/input-otp, components/meter, components/segment]
---

An invented shop's sign-in. Nothing is sent anywhere: each step only moves the screen along.

::example{id=showcase-auth}

- A [Segment](/components/segment/) switches between two forms. Each keeps its own `autoComplete` hints (`current-password` / `new-password`) and rules; the sign-up password needs a `validate` pass and a [Meter](/components/meter/) shows its strength as you type. Create account stays disabled (an accessor) until the terms [Checkbox](/components/checkbox/) is ticked.
- The password field is an [InputGroup](/components/input-group/) with a show / hide button in its suffix.
- Submitting moves to a one-time code step on [InputOTP](/components/input-otp/): `onComplete` checks the code (the demo code is on the screen) and a wrong one turns the slots invalid with a message.
- "Forgot password?" and "Email me a sign-in link" open the reset flow, whose status line never reveals whether the address has an account.
- One step shows at a time: the server renders the form step, and the code, reset and done steps are created in the browser when you reach them. From 1024 px a brand panel (CSS gradients, no image) fills the left half.
- The brand panel's colour blobs drift on a `<canvas>`. The server paints the same CSS gradient, and a `clientEffect` starts the animation once the panel is visible, so the canvas fades in over an identical first frame. It draws soft radial gradients at half resolution with `screen` blending, pauses off screen and in background tabs, never runs below 1024 px, and draws one still frame when reduced motion is on.
