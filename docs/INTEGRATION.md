# Integration guide

The same snippet goes into all three products. Only `product` changes.

## 1. Load the script (once, in your app shell)

```html
<script src="https://cdn.limechat.ai/nps/limechat-nps.js" async></script>
```

The snippet exposes a command queue (`window.LimeChatNPS`) so calls made before the script finishes loading are buffered — exactly like analytics SDKs.

## 2. Initialise with the logged-in user

Call this once you know who the user is (after auth resolves).

### CRM
```js
window.LimeChatNPS = window.LimeChatNPS || [];
LimeChatNPS.push(['init', {
  writeKey: 'pk_live_xxx',
  product:  'crm',
  account:  { id: currentAccount.id, name: currentAccount.name },
  user:     { email: currentUser.email, id: currentUser.id }
}]);
```

### Marketing
```js
LimeChatNPS.push(['init', {
  writeKey: 'pk_live_xxx',
  product:  'marketing',
  account:  { id: currentAccount.id, name: currentAccount.name },
  user:     { email: currentUser.email, id: currentUser.id }
}]);
```

### Bot
```js
LimeChatNPS.push(['init', {
  writeKey: 'pk_live_xxx',
  product:  'bot',
  account:  { id: currentAccount.id, name: currentAccount.name },
  user:     { email: currentUser.email, id: currentUser.id }
}]);
```

On `init` the widget automatically checks eligibility and, if the user is due this month, shows the pop-up. **You don't have to call anything else.**

## 3. (Optional) Control when it appears

By default the pop-up appears ~4s after init (configurable via `showDelayMs`) so it doesn't interrupt page load. To trigger it on a behavioural moment instead — after onboarding, after closing a support ticket, on renewal — set `auto: false` and call `show()` yourself:

```js
LimeChatNPS.push(['init', { /* …config…, */ auto: false }]);

// later, e.g. right after a user finishes onboarding:
LimeChatNPS.push(['show']);   // still respects the once-a-month throttle
```

This matches the behavioural/transactional survey guidance in the NPS spec (survey after onboarding, after a closed ticket, before/after renewal) while never asking the same user twice in a month.

## 4. Config reference

| key | type | default | notes |
| --- | --- | --- | --- |
| `writeKey` | string | — | public key, required |
| `product` | `'crm'\|'marketing'\|'bot'` | — | required |
| `account.id` | string | — | platform-unique account id, required |
| `account.name` | string | — | display only |
| `user.email` | string | — | required |
| `user.id` | string | — | host user id, optional |
| `auto` | boolean | `true` | auto-check eligibility + show |
| `showDelayMs` | number | `4000` | delay before auto-show |
| `apiBase` | string | `https://nps.limechat.ai` | override for staging |
| `position` | `'bottom-right'\|'bottom-left'\|'center'` | `'bottom-right'` | pop-up placement |
| `accentColor` | string | `#1fa97a` | brand accent |
| `onSubmit(payload)` | function | — | callback after a score is sent |
| `onDismiss()` | function | — | callback when closed without scoring |

## 5. What the user sees

1. A compact card slides in: *"How likely are you to recommend LimeChat CRM to a friend or colleague?"*
2. A 0–10 scale (color-coded: red detractors → green promoters).
3. After picking a score, a follow-up appears: *"What's the most important reason for your score?"* with a text box.
4. Submit → thank-you state → auto-closes. The user won't see it again on that product until next month.

## 6. Testing your integration

Point `apiBase` at staging and use a `pk_test_…` key. Hitting `GET /v1/nps/eligibility` twice in a month for the same user returns `eligible:false` on the second call — that confirms the throttle is wired correctly.
