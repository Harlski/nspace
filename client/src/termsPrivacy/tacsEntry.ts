import "../style.css";
import { bootstrapClientI18n } from "../i18n/bootstrap.js";
import body from "./content/tacs-body.html?raw";
import { mountTermsPrivacyPage } from "./mountTermsPrivacyPage.js";

bootstrapClientI18n();
mountTermsPrivacyPage({
  documentTitle: "Terms & Conditions · Nimiq Space",
  titleLine1: "TERMS",
  titleLine2: "CONDITIONS",
  bundleMetaSuffix: "Last Updated __TERMS_PRIVACY_DOCS_PLACEHOLDER__",
  bodyFragmentHtml: body,
  footerCurrent: "tacs",
});
