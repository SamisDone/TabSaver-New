# Privacy Policy for TabSaver 2.0

**Effective Date:** January 13, 2026

TabSaver ("we," "us," or "our") respects your privacy and is committed to protecting the information you share with us while using our Chrome extension. This Privacy Policy describes how we handle information in connection with the TabSaver extension.

## 1. Information We Collect

### Data Stored Locally

TabSaver is designed to function as a local utility. All data related to your saved sessions, including:

- Page titles
- URLs
- Tab group information
- Custom tags
- Visual thumbnails of active tabs

is stored **locally on your device** using the `chrome.storage.local` API.

### Personal Information

We **do not collect** any personally identifiable information (PII) such as your name, email address, physical address, or phone number.

### Browsing History

The extension requires the `tabs` and `activeTab` permissions to save and restore your sessions. This data is processed only to provide the extension's core functionality and is never transmitted to us or any third parties.

## 2. Use of Information

The data collected by the extension is used solely for:

- Saving and restoring your browser tab sessions.
- Providing search and organization features (tags).
- Displaying visual thumbnails to help you identify sessions.
- Managing auto-save backups.

## 3. Data Storage and Security

- **No Cloud Storage:** Your data is not uploaded to any external servers or cloud storage managed by us.
- **Local Control:** You have full control over your data. You can delete saved sessions or clear all extension data at any time through the extension's interface or your browser's extension management settings.
- **Export/Import:** The extension provides a feature to export your data to a JSON file. This file is stored on your local machine and its security is your responsibility.

## 4. Third-Party Access

We do not sell, trade, or otherwise transfer your information to outside parties. Since all data is stored locally, no third party has access to your saved sessions.

## 5. Permissions Justification

- `tabs`: Required to read the URLs and titles of your open tabs to save them.
- `storage`: Required to save your sessions and settings locally on your computer.
- `tabGroups`: Required to preserve and restore Chrome tab groups.
- `notifications`: Used to provide status updates (e.g., when an auto-save completes).
- `alarms`: Used to trigger the auto-save engine at user-defined intervals.

## 6. Changes to This Privacy Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy in the extension's repository or updating the `privacy policy.md` file.

## 7. Contact Us

If you have any questions about this Privacy Policy, you can contact the developer through the project's GitHub repository: [https://github.com/SamisDone](https://github.com/SamisDone)
