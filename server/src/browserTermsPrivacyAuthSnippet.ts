import { TERMS_PRIVACY_DOCS_VERSION as DocsVer } from "./termsPrivacyVersion.js";

/**
 * Inlined into server-rendered main-site HTML (analytics, payouts admin HTML, etc.) for wallets
 * that sign in via Hub without the bundled TS client — same `/api/auth/verify` acknowledgement contract.
 *
 * Implemented as concatenation so this file parses cleanly under `tsc` (no `{` ambiguity in nested templates).
 */
export function browserTermsPrivacyRuntimeScript(): string {
  const v = JSON.stringify(DocsVer);
  return (
    "(function(){if(typeof window===\"undefined\")return;" +
    "var TERMS_PRIVACY_DOCS_VERSION=" +
    v +
    ";" +
    "window.NSPACE_TERMS_PRIVACY_DOCS_VERSION=TERMS_PRIVACY_DOCS_VERSION;" +
    "window.nspaceTermsPrivacyPersistLocal=function(){" +
    "try{localStorage.setItem(\"nspace_terms_privacy_ack_\"+TERMS_PRIVACY_DOCS_VERSION,\"1\");" +
    "for(var i=localStorage.length-1;i>=0;i--){" +
    "var kk=localStorage.key(i);" +
    "if(kk&&kk.indexOf(\"nspace_legal_bundle_\")===0){localStorage.removeItem(kk);}" +
    "}}catch(e){}};" +
    "window.nspaceTermsPrivacyVerifyPayload=function(hubPayload,acceptedTermsPrivacyVersion){" +
    "var o={nonce:hubPayload.nonce,message:hubPayload.message," +
    "signerPublicKey:hubPayload.signerPublicKey,signature:hubPayload.signature};" +
    "if(hubPayload.signer!==undefined&&hubPayload.signer!==null&&" +
    "String(hubPayload.signer).trim()!==\"\"){" +
    "o.signer=hubPayload.signer;}" +
    "if(hubPayload.nimiqPayClient===true){o.nimiqPayClient=true;}" +
    "if(acceptedTermsPrivacyVersion){o.acceptedTermsPrivacyVersion=acceptedTermsPrivacyVersion;}" +
    "return o;};" +
    "window.nspaceShowTermsPrivacyAckBarrier=function(){" +
    "return new Promise(function(resolve,reject){" +
    "var ex=document.getElementById(\"nspaceTermsPrivacyOverlay\");" +
    "if(ex)ex.remove();" +
    "var wrap=document.createElement(\"div\");" +
    "wrap.id=\"nspaceTermsPrivacyOverlay\";" +
    "wrap.setAttribute(\"role\",\"dialog\");" +
    "wrap.setAttribute(\"aria-modal\",\"true\");" +
    "wrap.style.cssText=\"position:fixed;inset:0;background:rgba(0,0,0,0.55);" +
    "z-index:99999;display:flex;align-items:center;justify-content:center;" +
    "padding:1rem;box-sizing:border-box;\";" +
    "var card=document.createElement(\"div\");" +
    "card.style.cssText=\"background:#161d2a;border:1px solid #324258;border-radius:12px;" +
    "max-width:26rem;width:100%;padding:1.1rem;color:#e6edf3;" +
    "font:500 0.875rem ui-sans-serif,system-ui,sans-serif;line-height:1.45;box-sizing:border-box;\";" +
    "var title=document.createElement(\"div\");" +
    "title.textContent=\"Terms & privacy\";" +
    "title.style.cssText=\"font-weight:700;font-size:1rem;margin:0 0 0.5rem;" +
    "letter-spacing:0.03em;\";" +
    "card.appendChild(title);" +
    "var p=document.createElement(\"p\");" +
    "p.style.margin=\"0 0 0.75rem\";" +
    "p.innerHTML=\"Review the <a href='/tacs' target='_blank' rel='noopener noreferrer' style='color:#7dd3fc'>Terms &amp; Conditions</a> \"+" +
    "\"and <a href='/privacy' target='_blank' rel='noopener noreferrer' style='color:#7dd3fc'>Privacy Policy</a>. \"+" +
    "\"Checking the box confirms you have read both and agree to continue.\";" +
    "card.appendChild(p);" +
    "var row=document.createElement(\"label\");" +
    "row.style.cssText=\"display:flex;align-items:flex-start;gap:0.5rem;" +
    "cursor:pointer;margin:0 0 1rem;\";" +
    "var cb=document.createElement(\"input\");" +
    "cb.type=\"checkbox\";" +
    "cb.style.marginTop=\"0.2rem\";" +
    "var lbl=document.createElement(\"span\");" +
    "lbl.textContent=\"I have read and agree to the Terms and Privacy Policy.\";" +
    "row.appendChild(cb);row.appendChild(lbl);card.appendChild(row);" +
    "var btnRow=document.createElement(\"div\");" +
    "btnRow.style.cssText=\"display:flex;flex-wrap:wrap;" +
    "justify-content:flex-end;gap:0.5rem;\";" +
    "var cancel=document.createElement(\"button\");" +
    "cancel.type=\"button\";cancel.textContent=\"Cancel\";" +
    "cancel.style.cssText=\"cursor:pointer;background:transparent;" +
    "border:1px solid #3d5169;color:#c8d4e4;border-radius:8px;" +
    "padding:0.42rem 0.75rem;font:inherit;\";" +
    "cancel.addEventListener(\"click\",function(){" +
    "wrap.remove();reject(new Error(\"terms_privacy_ack_cancelled\"));});" +
    "var go=document.createElement(\"button\");" +
    "go.type=\"button\";go.textContent=\"Continue to wallet\";go.disabled=true;" +
    "go.style.opacity=\"0.5\";" +
    "go.style.cursor=\"pointer\";" +
    "go.style.background=\"rgba(90,160,255,0.25)\";" +
    "go.style.border=\"1px solid #5aa0ff\";" +
    "go.style.color=\"#e8f0fc\";" +
    "go.style.borderRadius=\"8px\";" +
    "go.style.padding=\"0.42rem 0.75rem\";" +
    "go.style.font=\"inherit\";" +
    "go.style.fontWeight=\"600\";" +
    "cb.addEventListener(\"change\",function(){" +
    "go.disabled=!cb.checked;go.style.opacity=cb.checked?\"1\":\"0.5\";});" +
    "go.addEventListener(\"click\",function(){if(!cb.checked)return;" +
    "wrap.remove();resolve(undefined);});" +
    "btnRow.appendChild(cancel);btnRow.appendChild(go);card.appendChild(btnRow);" +
    "wrap.appendChild(card);" +
    "wrap.addEventListener(\"click\",function(ev){if(ev.target===wrap){" +
    "wrap.remove();reject(new Error(\"terms_privacy_ack_cancelled\"));}});" +
    "document.body.appendChild(wrap);cb.focus();});};" +
    "window.nspacePostAuthVerify=function(payloadObj){return fetch(\"/api/auth/verify\",{" +
    "method:\"POST\",headers:{\"content-type\":\"application/json\"}," +
    "body:JSON.stringify(payloadObj)});};})();"
  );
}
