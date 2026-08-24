# Catch the Lost Dog — Product Requirements and Technical Design

## 1. Purpose

Create a short, playful web experience that invites the recipient to an anniversary dinner. The recipient helps catch an animated lost dog; once the dog is caught, it delivers an envelope containing the dinner invitation.

The experience should feel personal, romantic, and fun while remaining easy to complete on both phones and computers.

## 2. Goals

- Present the anniversary invitation as a memorable mini-game.
- Keep the experience short: approximately 30–60 seconds before the invitation appears.
- Work through a shareable web link without installation or account creation.
- Support mouse, touch, and keyboard input.
- Make success inevitable so the game never blocks the invitation.
- Keep invitation data private enough for a personal event and avoid collecting unnecessary data.

## 3. Out of scope for the first version

- User accounts or authentication.
- Multiplayer gameplay.
- A server-side database.
- An administration dashboard.
- App Store or Play Store distribution.
- Advanced collision physics or procedurally generated levels.
- Tracking the recipient without explicit consent.

## 4. User journey

1. The recipient opens the shared link.
2. A landing scene shows a dog carrying an envelope.
3. The page explains that the dog has run away with an important message.
4. The recipient starts the chase.
5. The dog moves between safe positions as the recipient tries to catch it.
6. Near misses produce encouraging feedback and make the dog progressively easier to catch.
7. On a successful catch, the dog moves to the center and drops the envelope.
8. The envelope opens and transforms into the dinner invitation.
9. The recipient accepts the invitation.
10. A final celebration appears with optional event details and an Add to Calendar action.

## 5. Functional requirements

### FR-1: Landing scene

- The app shall display a full-screen, mobile-first illustrated scene.
- The scene shall show the dog, an envelope, a short introductory message, and a clear **Start chasing** button.
- The chase shall not begin until the recipient activates the button.
- The landing scene may include a personal greeting configured by the creator.

### FR-2: Game area

- The game shall run inside the visible viewport without horizontal or vertical page scrolling during play.
- The dog shall remain fully visible and inside a safe area that excludes controls and screen edges.
- The game shall adapt when the viewport is resized or the device orientation changes.
- Decorative elements such as trees, flowers, a bench, pawprints, clouds, or fireflies may animate without affecting gameplay.

### FR-3: Dog behavior

- The dog shall move to a new position when the recipient attempts to catch it and misses.
- The dog shall use playful animations such as running, looking back, wagging its tail, or hiding briefly.
- Positions shall be selected from validated zones so the dog never overlaps important text or controls.
- The dog shall become easier to catch after each miss by reducing movement distance, increasing the hit target, slowing animation, or pausing longer.
- The game shall guarantee success after a configurable maximum number of attempts. The recommended default is four attempts.

### FR-4: Input

- The recipient shall be able to catch the dog using a mouse click or touch.
- The visible dog may have a larger invisible hit area to make interaction forgiving.
- Keyboard users shall be able to focus the dog and activate it with Enter or Space.
- Input shall be temporarily locked while the dog is moving to prevent duplicate attempts.

### FR-5: Feedback during the chase

- Each unsuccessful attempt shall display a short encouraging message, for example “Almost!” or “He’s a speedy little matchmaker!”
- The app shall provide visible feedback for interaction; sound and vibration are optional enhancements.
- If sound is included, it shall start only after user interaction and shall have an accessible mute control.
- The recipient shall always have access to a subtle **Skip the chase** action that reveals the invitation.

### FR-6: Successful catch

- On success, the dog shall stop escaping and animate toward a central presentation position.
- The scene shall transition into a celebration without reloading the page.
- The dog shall drop or present the envelope.
- The envelope-opening sequence shall reveal the invitation card.

### FR-7: Invitation card

- The invitation shall display configurable content:
  - recipient name;
  - personal message;
  - occasion;
  - date and time;
  - pickup or meeting time;
  - location or a “surprise” label;
  - dress suggestion;
  - optional photograph.
- The card shall include one clear acceptance action.
- The invitation shall remain readable without animation and on small screens.
- The card shall not expose intentionally hidden details before the reveal.

### FR-8: Acceptance and final state

- Activating the acceptance button shall show a celebration animation and confirmation message.
- The final state may reveal additional details that were intentionally hidden before acceptance.
- The final state shall offer an **Add to calendar** action.
- The final state may offer a pre-written reply through a normal share or messaging link.
- Acceptance shall be stored locally so reopening the page can return to the invitation or celebration instead of restarting the game.

### FR-9: Calendar event

- The app shall provide a downloadable `.ics` calendar event generated from configured event details.
- The event shall include title, start time, end time, location when disclosed, and an optional description.
- Calendar times shall include an explicit time zone.

### FR-10: Restart and recovery

- A small restart control shall allow the recipient to replay the experience.
- Refreshing during the chase may restart the current chase.
- Refreshing after acceptance shall preserve the accepted state using browser storage.
- If browser storage is unavailable, the app shall continue to work without persistence.

### FR-11: Accessibility

- All interactive elements shall have accessible names and visible focus styles.
- Text and controls shall meet WCAG AA color contrast targets.
- The app shall honor `prefers-reduced-motion` by replacing movement-heavy effects with fades or immediate transitions.
- Important information shall never be conveyed by color, animation, or sound alone.
- The invitation shall remain available when JavaScript animation APIs are unsupported.

### FR-12: Privacy and sharing

- The app shall not require personal information from the recipient.
- Analytics shall be excluded by default.
- The deployed URL should use an unguessable path or deployment identifier.
- Highly sensitive information, such as a home address, should be omitted or revealed separately because a secret URL is not strong authentication.

## 6. Game rules

Recommended default behavior:

| Attempt | Dog response | Difficulty adjustment |
| --- | --- | --- |
| 1 | Runs a long distance | Normal hit area |
| 2 | Hides briefly, then reappears | 15% larger hit area |
| 3 | Runs a shorter distance and pauses | 30% larger hit area |
| 4 | Allows the catch | Guaranteed success |

A direct activation on the dog can succeed earlier. The attempt schedule is a safety net, not a requirement to miss several times.

## 7. Acceptance criteria

- A first-time recipient can reach the invitation in no more than four attempts.
- The complete flow works at viewport widths from 320 px upward.
- Mouse, touch, Enter, and Space can complete the game.
- The dog never renders outside the visible game area.
- The invitation cannot be obscured by the dog or decorative layers.
- Reduced-motion mode contains no rapid or large chase movement.
- The invitation remains usable if audio is blocked or unavailable.
- Accepting the invitation persists across a page refresh when local storage is available.
- The calendar file opens with the configured local date, time, and time zone.
- The deployed app loads over HTTPS and does not send recipient data to a backend.

## 8. Technical design

### 8.1 Architecture

The first version should be a static single-page application:

```text
Browser
  ├── Presentation layer (scene, dog, envelope, invitation)
  ├── Game controller (state and attempt logic)
  ├── Animation layer (CSS/Web Animations API)
  ├── Configuration (copy and event details)
  └── Local persistence (accepted/replayed state)

Static HTTPS host
  ├── HTML, CSS, and JavaScript bundle
  ├── Image/audio assets
  └── Pre-generated calendar file
```

No backend is required. This minimizes setup, failure modes, cost, and privacy risk.

### 8.2 Recommended implementation

- Use semantic HTML for the page structure and invitation content.
- Use CSS for responsive layout, visual styling, and simple transitions.
- Use JavaScript or TypeScript for the state machine, pointer handling, safe-position calculation, persistence, and calendar action.
- Use CSS transforms (`translate3d`) to move the dog efficiently without repeatedly changing document layout.
- Use SVG or transparent WebP/PNG assets for the dog and scenery. A small sprite sheet or layered SVG can provide multiple dog poses.
- Keep the app buildable as static files so it can be deployed to any HTTPS static host.

A framework is optional. For a single scene, plain TypeScript is sufficient. If the project is expected to grow or the creator prefers reusable UI components, a small component-based frontend setup is reasonable, but it should not introduce a backend.

### 8.3 Application state machine

The UI shall be driven by an explicit state rather than loosely coordinated visibility flags.

```text
INTRO
  └── start → CHASING

CHASING
  ├── miss → DOG_MOVING
  ├── catch → CAUGHT
  └── skip → CAUGHT

DOG_MOVING
  └── animation complete → CHASING

CAUGHT
  └── envelope animation complete → INVITATION

INVITATION
  └── accept → ACCEPTED

ACCEPTED
  ├── add to calendar
  ├── send reply
  └── replay → INTRO
```

Suggested state shape:

```ts
type ScreenState =
  | "intro"
  | "chasing"
  | "dogMoving"
  | "caught"
  | "invitation"
  | "accepted";

interface GameState {
  screen: ScreenState;
  attempts: number;
  dogPosition: { x: number; y: number };
  inputLocked: boolean;
  muted: boolean;
  reducedMotion: boolean;
}
```

### 8.4 Configuration model

Personal and event content should be kept in one configuration object so it can be changed without editing game logic.

```ts
interface InvitationConfig {
  recipientName: string;
  greeting: string;
  invitationMessage: string;
  eventTitle: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  meetingText: string;
  location?: string;
  dressSuggestion?: string;
  acceptedMessage: string;
  replyUrl?: string;
  maximumAttempts: number;
}
```

Secrets shall not be placed in this object. All files delivered to a browser can be inspected by the recipient or anyone with the URL.

### 8.5 Positioning and collision strategy

The game area shall expose its dimensions with `getBoundingClientRect()`. The dog controller shall calculate candidate positions within an inset safe rectangle.

For each candidate position:

1. Subtract the dog dimensions and a screen-edge margin from the available area.
2. Reject positions intersecting reserved UI rectangles such as instructions, mute, and skip controls.
3. Reject positions too close to the current dog position unless the game is in its easiest stage.
4. Choose from the remaining candidates and clamp final coordinates to valid bounds.

Use a separate, larger hit target around the dog. Pointer proximity can be calculated using the distance between the pointer and the dog center. The allowed distance increases with the attempt count.

### 8.6 Animation design

- Animate the dog using transforms and opacity for smooth performance.
- Use a short run loop while the dog transitions between positions.
- Use a finite envelope sequence: drop, bounce, open, expand, reveal card.
- Use lightweight CSS particles for the final celebration and cap their number on small devices.
- Cancel or shorten active animations when reduced-motion mode is enabled.
- Avoid relying on exact animation timing for state changes; use animation completion events with a fallback timeout.

### 8.7 Layering

Recommended visual stacking order:

| Layer | Content |
| --- | --- |
| 0 | Sky and background gradient |
| 1 | Distant scenery |
| 2 | Foreground scenery and hiding places |
| 3 | Pawprints and decorative effects |
| 4 | Dog and interactive hit target |
| 5 | Instructions and controls |
| 6 | Envelope and invitation modal |
| 7 | Celebration effects, without intercepting input |

Decorative layers shall use `pointer-events: none`. Only intentional controls and the dog hit target shall receive input.

### 8.8 Persistence

Use local storage with one versioned key, for example `anniversary-invitation:v1`.

Persist only:

```json
{
  "accepted": true,
  "muted": false
}
```

Do not store names, messages, or event details unnecessarily. Storage access shall be wrapped in error handling because it can fail in private browsing or restricted environments.

### 8.9 Calendar generation

The simplest option is to generate and deploy a static `.ics` file as part of the build. This avoids runtime time-zone conversion mistakes. If event details are configured dynamically, generate the file from the same configuration source during the build.

The calendar file shall use escaped iCalendar text, stable UID and UTC timestamps or an explicit `TZID`. Test the file in at least Apple Calendar, Google Calendar import, and Outlook.

### 8.10 Responsive design

- Use the dynamic viewport unit `dvh` with a suitable fallback.
- Respect device safe-area insets for controls on phones with display cutouts.
- Scale scenery independently from interactive target sizes.
- Keep tap targets at least 44 × 44 CSS pixels.
- Recalculate and clamp the dog position after resize or orientation change.
- Prefer portrait composition while ensuring landscape remains playable.

### 8.11 Performance targets

- Initial compressed transfer should preferably stay below 2 MB, dominated by imagery and optional audio.
- Provide appropriately sized responsive images.
- Preload only the dog and first-scene assets; lazy-load celebration media.
- Target smooth transform animation on a typical mobile device.
- Avoid large animation libraries unless they materially improve the envelope or character sequence.

### 8.12 Error handling and graceful degradation

- If an image fails, preserve a visible text invitation and usable controls.
- If animation APIs are unavailable, move between states immediately.
- If local storage fails, continue without persistence.
- If the calendar download fails, display the event details in copyable text.
- If audio fails, continue silently without showing an error dialog.

### 8.13 Security and privacy

- Deploy over HTTPS.
- Do not include API keys or credentials in frontend files.
- Do not load third-party tracking scripts.
- Prefer self-hosted images, fonts, and sounds to reduce third-party requests.
- Set a restrictive Content Security Policy when supported by the host.
- Treat an unguessable URL as a convenience measure, not as secure authentication.

## 9. Suggested project structure

```text
anniversary-app/
  public/
    assets/
      dog/
      scenery/
      sounds/
    invitation.ics
  src/
    config.ts
    main.ts
    styles.css
    game/
      controller.ts
      positioning.ts
      state.ts
    ui/
      intro.ts
      chase.ts
      invitation.ts
      celebration.ts
    accessibility/
      motion.ts
      announcements.ts
  index.html
  DESIGN.md
```

The exact layout may be simplified if plain HTML, CSS, and JavaScript are used without a build tool.

## 10. Testing strategy

### Unit tests

- State transitions.
- Attempt-based difficulty calculation.
- Candidate position validation and boundary clamping.
- Calendar data generation and escaping.
- Persistence behavior when storage succeeds or throws.

### Interaction tests

- Complete the flow with mouse input.
- Complete the flow with touch input.
- Complete the flow with keyboard input.
- Use skip and replay actions.
- Reload before and after acceptance.
- Resize and rotate during the chase.

### Visual and accessibility checks

- Small phone, large phone, tablet, and desktop layouts.
- Light levels and text contrast over the illustrated background.
- Reduced-motion mode.
- Screen-reader reading order and live feedback messages.
- Visible focus and minimum touch target sizes.

## 11. Delivery plan

### Phase 1: Functional prototype

- Implement the state machine and all screens with placeholder artwork.
- Add pointer, touch, keyboard, skip, and guaranteed-success behavior.
- Add responsive dog positioning and the basic invitation reveal.

### Phase 2: Personalization and visual polish

- Add final dog and park artwork.
- Add character, envelope, and celebration animations.
- Insert the personal copy, dinner details, and optional photo.
- Add optional sound and mute behavior.

### Phase 3: Hardening and launch

- Add calendar download and local persistence.
- Run cross-device and accessibility tests.
- Optimize assets and deploy to an HTTPS static host.
- Test the exact shared URL on the recipient's likely device class before sending it.

## 12. Product decisions still to personalize

- Dog appearance, name, and personality.
- Illustration style and color palette.
- Exact personal greeting and invitation wording.
- Dinner date, time zone, pickup details, and location visibility.
- Whether acceptance opens a messaging reply.
- Whether music or sound effects are appropriate.
- Whether the final screen reveals the destination or preserves the surprise.
