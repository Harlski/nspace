import "../style.css";
import body from "./content/tacs-body.html?raw";
import { mountTermsPrivacyPage } from "./mountTermsPrivacyPage.js";

mountTermsPrivacyPage({
  documentTitle: "Terms & Conditions · Nimiq Space",
  titleLine1: "TERMS",
  titleLine2: "CONDITIONS",
  bundleMetaSuffix: "Last Updated __TERMS_PRIVACY_DOCS_PLACEHOLDER__",
  bodyFragmentHtml: body,
  footerCurrent: "tacs",
});
