# QuickCopy Privacy Policy

**Last updated:** August 15, 2026

## The short version

QuickCopy does not collect, transmit, or store any personal data. Everything the extension does — OCR, clipboard writes, and PDF viewing — happens locally on your device.

## Data collection

QuickCopy collects **no data**:

- **No personal information.** QuickCopy has no accounts, no logins, and no profile of any kind.
- **No usage statistics.** No analytics, crash reporting, telemetry, or anonymous metrics are gathered by the extension or by the publisher.
- **No content.** The text you capture, copy, or edit never leaves your device. Captured screenshots are held in memory only while OCR runs and are discarded immediately after.
- **No remote requests at capture time.** Every capture, OCR pass, and clipboard write is executed locally. The only network activity the extension ever performs is downloading language model files (`*.traineddata`) from the project's public GitHub repository when you explicitly choose to add a second OCR language in the settings page. These files are downloaded over HTTPS directly from the extension publisher's public repository, cached locally, and never used for anything other than OCR.

## Permissions and what they are used for

| Permission | Why QuickCopy needs it |
| --- | --- |
| `clipboardWrite` | Copy OCR results to your clipboard. |
| `activeTab` / `tabs` | Capture the visible region of the current tab and detect PDF tabs to open the built-in PDF viewer. |
| `storage` | Save your settings (drag modifier, dark mode, OCR language) and cached language data locally. |
| `commands` | Keyboard shortcuts (`Alt+Shift+Q` capture, `Alt+Shift+S` sidebar). |
| `offscreen` | Run OCR and clipboard writes from Chrome's offscreen document in browser contexts that restrict extension workers. |
| `alarms` | Periodic OCR worker housekeeping. |
| `<all_urls>` (host permission) | Render the capture overlay and run OCR on any page — including videos, images, and built-in PDF viewers — no matter which site you are on. This permission is used only to draw the overlay and read the screen; QuickCopy never reads, modifies, or uploads page content. |

## Data retention and sharing

- **Retention:** nothing is stored. Language model files downloaded to your device stay in the extension's local storage and can be removed at any time by uninstalling the extension or clearing its data in `chrome://extensions`.
- **Sharing:** nothing is ever shared. No third parties, no advertisers, no servers operated by anyone other than the extension publisher.

## Changes to this policy

If this policy changes, the updated version will be published at the same URL with a new revision date.

## Contact

Questions or concerns: **helloquickcopy@gmail.com** — or open an issue at https://github.com/shivam4tech/QuickCopy/issues.
