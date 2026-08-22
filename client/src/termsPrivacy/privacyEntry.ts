import "../style.css";
import { bootstrapClientI18n } from "../i18n/bootstrap.js";
import body from "./content/privacy-body.html?raw";
import { mountTermsPrivacyPage } from "./mountTermsPrivacyPage.js";

bootstrapClientI18n();
mountTermsPrivacyPage({
  documentTitle: "Privacy Policy · Nimiq Space",
  titleLine1: "PRIVACY",
  titleLine2: "POLICY",
  bundleMetaSuffix: "Last Updated __TERMS_PRIVACY_DOCS_PLACEHOLDER__",
  bodyFragmentHtml: body,
  footerCurrent: "privacy",
});
