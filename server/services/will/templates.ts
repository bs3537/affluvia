import type { WillRenderContext, BeneficiarySlice } from "@shared/will-types";

const baseCss = `
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111827; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 8px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; }
  h2 { font-size: 16px; margin: 16px 0 8px; }
  p { margin: 8px 0; }
  ol { padding-left: 18px; }
  .article { margin: 14px 0; }
  .signature { margin-top: 24px; display: flex; gap: 16px; }
  .sig-line { flex: 1; border-top: 1px solid #111; padding-top: 4px; text-align: center; font-size: 12px; }
  .page { page-break-after: always; }
  .box { border: 1px solid #111; padding: 8px; }
  .small { font-size: 12px; color: #374151; }
`;

function renderSlicesHuman(slices: BeneficiarySlice[]): string {
  if (!slices?.length) return "";
  return slices.map((s) => `${s.percent}% to ${s.name}`).join(", ");
}

function renderSlices(title: string, slices: BeneficiarySlice[]): string {
  if (!slices?.length) return "";
  const list = slices.map((s) => `${s.name} (${s.kind}) – ${s.percent}%`).join("; ");
  return `<p><strong>${title}:</strong> ${list}.</p>`;
}

export function renderInstructions(_ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <div class="page">
    <h1>Instructions for Will 1 of 3</h1>
    <p>You’re almost done! Follow these instructions to make your will legally valid.</p>
    <ul>
      <li>Read your will carefully and make sure you understand everything. If you have questions, speak with a lawyer.</li>
      <li>Find two witnesses who are at least 18 and mentally competent. They and their spouses should not receive gifts in your will.</li>
      <li>You and your witnesses must sign and date your will in the same session.</li>
      <li>While in the presence of your witnesses, state: “This is my Last Will and Testament that I am signing, and it represents my wishes.”</li>
    </ul>
  </div>
  <div class="page">
    <h1>Instructions for Will 2 of 3</h1>
    <ul>
      <li>You may use the Personal Property Memorandum for tangible items (e.g., jewelry, art, electronics) not specifically gifted in your will. Sign and date it if you use it.</li>
      <li>If you wish to make your will self‑proving, meet with a notary together with your two witnesses to complete the notarial acknowledgment.</li>
      <li>Store your original, signed will in a safe, accessible place (e.g., a fire‑resistant box). Do not remove staples or tear pages.</li>
      <li>Let your executor know where to find the original and ensure they can access it.</li>
    </ul>
  </div>
  <div>
    <h1>Instructions for Will 3 of 3</h1>
    <p class="small">You may distribute copies of your signed will for reference, but your original must be located after your death for probate. Update your will after major life changes (marriage, birth, divorce, relocation). This material is not legal advice.</p>
  </div>
  </body></html>`;
}

export function renderWill(ctx: WillRenderContext): string {
  const where = ctx.city ? `, of ${ctx.city}${ctx.state ? ", " + ctx.state : ""}` : "";
  const childrenLine = ctx.children.length
    ? `I have ${ctx.children.length} ${ctx.children.length === 1 ? "child" : "children"}, namely: ${ctx.children.join(", ")}. All references in this Will to “My Children” include this child(ren) and any hereafter born to or adopted by me. All references to “my descendants” include My Children and all of their respective descendants.`
    : "I have no children.";
  const primary = renderSlicesHuman(ctx.residuary.primary?.slices || []);
  const secondary = ctx.residuary.secondary?.slices?.length ? renderSlicesHuman(ctx.residuary.secondary.slices) : "";
  const tertiary = ctx.residuary.tertiary?.slices?.length ? renderSlicesHuman(ctx.residuary.tertiary.slices) : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
    <h1>Last Will and Testament of ${ctx.fullName}</h1>

    <div class="article">
      <h2>Article I: Declarations</h2>
      <p>I, ${ctx.fullName}${where}, declare this to be my Will, and I revoke all Wills and Codicils previously made by me.</p>
      <p>As of the date of this Will, ${ctx.spouseName ? `I am married to ${ctx.spouseName}.` : "I am not married."}</p>
      <p>${childrenLine}</p>
    </div>

    <div class="article">
      <h2>Article II: Executor Provisions</h2>
      <p><strong>A. Executor —</strong> I nominate ${ctx.executors[0]?.name || "[Executor]"} to serve as Executor of my estate and to carry out the instructions in this Will.</p>
      <p><strong>B. Bond & Court Supervision —</strong> No bond or other security shall be required of my Executor (or Digital Executor) in any jurisdiction. To the extent permitted by the laws of the state in which my Will is probated, my Executor may administer my estate without court supervision, other than probating and recording this Will.</p>
      <p><strong>C. Executor Powers —</strong> My Executor shall have the following powers:</p>
      <ol>
        <li>The power to exercise all powers of an absolute owner of property;</li>
        <li>The power to retain, sell at public or private sale, exchange, grant options on, invest and reinvest, and otherwise deal with real or personal property;</li>
        <li>The power to borrow money and pledge property to secure loans;</li>
        <li>The power to divide and distribute property in cash or in kind;</li>
        <li>The power to compromise and release claims with or without consideration;</li>
        <li>The power to pay my legally enforceable debts, funeral expenses, expenses of last illness, and all expenses of estate administration;</li>
        <li>The power to employ attorneys, accountants, and other persons for services or advice;</li>
        <li>For minors, the power to distribute in the Executor’s discretion to a guardian, UTMA/UGMA custodian, or person caring for the beneficiary, or to apply amounts directly for health, support, maintenance, or education;</li>
        <li>The power to perform all acts necessary or appropriate for proper administration, execute and deliver instruments, and give full receipts and discharges;</li>
        <li>Any additional powers conferred upon executors wherever my Executor may act.</li>
      </ol>
      <p><strong>D. Expenses —</strong> My Executor shall be reimbursed for reasonable costs and expenses incurred in connection with Executor duties.</p>
      <p><strong>E. Reliance —</strong> In acting or declining to act, my Executor may rely upon the written opinion of competent counsel, facts stated in instruments believed true, or other evidence deemed sufficient; the Executor shall be indemnified and held harmless for actions taken in good faith without gross negligence.</p>
      <p><strong>F. Ancillary Executors —</strong> If my estate includes property in another state or foreign jurisdiction and my Executor cannot or chooses not to serve there, my Executor may nominate an ancillary individual or corporate Executor for such property.</p>
      <p><strong>G. Digital Executor —</strong> I authorize ${ctx.digitalExecutor?.name || ctx.executors[0]?.name || "[Digital Executor]"} to access, use, manage, close and control my Digital Assets and Digital Accounts, and I request such person follow any separate written wishes I have left. This authorization is intended to be lawful consent under applicable federal and state privacy and computer access laws.</p>
    </div>

    <div class="article">
      <h2>Article III: Gifts at Death (Tangible Personal Property)</h2>
      <p>“Tangible Personal Property” includes household goods, furnishings, pictures, books, clothing, jewelry, and other tangible items of similar nature. Except as provided elsewhere in this Will or in a signed memorandum regarding tangible personal property (including items associated with a gift of real property, if applicable), my Executor shall distribute the balance of my Tangible Personal Property to the beneficiaries listed in Article IV, with particular items to be allocated as they may agree, or, if they cannot agree, as my Executor determines in the Executor’s discretion. The cost of packing and shipping shall be an administration expense.</p>
    </div>

    <div class="article">
      <h2>Article IV: Gift of Residue</h2>
      ${renderSlices("Primary distributions", ctx.residuary.primary?.slices || [])}
      ${ctx.residuary.secondary?.slices?.length ? renderSlices("If a primary disposition does not survive", ctx.residuary.secondary.slices) : ""}
      ${ctx.residuary.tertiary?.slices?.length ? renderSlices("If the foregoing fail", ctx.residuary.tertiary.slices) : ""}
      <p>If any disposition in this Article fails, the related share shall be added pro rata to the remaining effective dispositions in this Article.</p>
    </div>

    <div class="article">
      <h2>Article V: Takers of Last Resort</h2>
      <p>If all other dispositions in this Will fail, the residue of my estate shall be distributed to my Heirs.</p>
    </div>

    <div class="article">
      <h2>Article VI: General Provisions</h2>
      <p><strong>A. Severability —</strong> If any provision of this Will is held unenforceable, the remaining provisions remain in full force to the fullest extent permitted by law.</p>
      <p><strong>B. Survivorship —</strong> A beneficiary shall be deemed to have survived me only if living on the thirtieth (30th) day after my death; a person legally prohibited from inheriting shall be treated as having failed to survive me.</p>
      <p><strong>C. Payment of Taxes —</strong> All estate, inheritance, or similar taxes (including interest and penalties) arising in connection with my death with respect to any property included in my gross estate shall be paid from the residue of my estate without apportionment, except that no such taxes shall be charged against property qualifying for the marital or charitable deduction unless necessary due to insufficiency of other assets.</p>
      <p><strong>D. HIPAA Release —</strong> My Executor (including any successor) shall be treated as my “personal representative” under HIPAA and its regulations and may receive and disclose my protected health information as necessary.</p>
      <p><strong>E. Payment of Expenses —</strong> All funeral and administration expenses shall be paid from the residue of my estate; if insufficient, the excess shall be paid pro rata from assets passing by reason of my death.</p>
      <p><strong>F. Savings Clause —</strong> Words of one gender include the other, and the singular includes the plural and vice versa, as context requires.</p>
      <p><strong>G. Terminology —</strong> “Descendants” means lineal blood descendants of any degree and includes adopted children and their descendants, except a person adopted after age 18 and that person’s descendants are excluded. “Heirs” means those who would inherit separate personal property from me under the intestacy statutes of my domiciliary state if I died unmarried and intestate at such time. “Per stirpes” distributions follow representation by branch starting at the nearest generation with survivors.</p>
      <p><strong>H. Discretion —</strong> Any discretion granted to my Executor or Digital Executor is intended to be sole, absolute, and unfettered.</p>
      <p><strong>I. Spendthrift Provisions —</strong> Prior to actual receipt, no interest distributable under this Will shall be subject to anticipation or assignment by any beneficiary or to claims of creditors.</p>
      ${ctx.provisions.includeSpecialNeedsTrust ? `<p><strong>J. Beneficiary Receiving Public Benefits —</strong> If a beneficiary is receiving or may be eligible for means‑tested government benefits, my Executor may withhold outright distribution and instead hold such beneficiary’s share in a separate trust for that beneficiary’s supplemental needs, to be used to supplement (not supplant) government benefits; the Trustee’s discretion shall be final, and the trust shall include customary restrictions (no withdrawal right, no general power of appointment) and terminate as provided therein.</p>` : ""}
    </div>

    <div class="article">
      <h2>Execution</h2>
      <p>Signed on ${ctx.todayISO} in ${ctx.city || "[City]"}, ${ctx.state || "[State]"}.</p>
      <div class="signature">
        <div class="sig-line">Signature of Willmaker</div>
        <div class="sig-line">Signature of First Witness</div>
        <div class="sig-line">Signature of Second Witness</div>
      </div>
    </div>
  </body></html>`;
}

export function renderPersonalPropertyMemo(ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <h1>Personal Property Memorandum</h1>
  <p>I, ${ctx.fullName}, created my Last Will and Testament on ${ctx.todayISO}. This memorandum disposes of certain tangible personal property not otherwise distributed in my Will.</p>
  <div class="box" style="min-height: 320px; margin-top: 12px;">
    <p class="small">Describe items and beneficiaries (add pages as needed).</p>
  </div>
  <div class="signature"><div class="sig-line">Signature</div><div class="sig-line">Date</div></div>
  </body></html>`;
}

export function renderDigitalAssetsSheet(_ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <h1>Digital Assets & Accounts</h1>
  <p class="small">This is a non-testamentary document to help your Executor locate and administer digital assets and accounts.</p>
  <div class="box" style="min-height: 480px; margin-top: 12px;"></div>
  </body></html>`;
}

export function renderFuneralWishes(ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <h1>Funeral Wishes & Instructions</h1>
  <p>Date created: ${ctx.todayISO}</p>
  <p>Agent(s): ${(ctx.executors || []).map((e) => e.name).join(", ")}</p>
  <div class="box" style="min-height: 320px; margin-top: 12px;"></div>
  </body></html>`;
}

export function renderBeneficiaryMessages(_ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <h1>Messages to Beneficiaries</h1>
  <div class="box" style="min-height: 480px; margin-top: 12px;"></div>
  </body></html>`;
}

export function renderAffidavit(ctx: WillRenderContext): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}</style></head><body>
  <h1>Self‑Proving Affidavit</h1>
  <p><strong>STATE:</strong> ${ctx.state || "__________"} &nbsp;&nbsp; <strong>COUNTY:</strong> __________</p>
  <p>Before me, the undersigned authority, on this day personally appeared ${ctx.fullName}, the testator, and the witnesses whose names are subscribed to the attached instrument, and all being duly sworn, the testator declared to me and to the witnesses in my presence that said instrument is the testator’s Last Will and Testament and that the testator executed it as a free act for the purposes expressed therein. Each witness stated the testator declared to them that the instrument is the testator’s Last Will and Testament and requested each witness to sign it; each witness signed in the presence of the testator and of each other; and at the time the testator was of sound mind and over the age of eighteen (18).</p>
  <div class="signature">
    <div class="sig-line">Signature of Testator</div>
    <div class="sig-line">Signature of First Witness</div>
    <div class="sig-line">Signature of Second Witness</div>
  </div>
  <p>Subscribed and sworn before me this ____ day of __________, ______.</p>
  <div class="signature">
    <div class="sig-line">Notary Public</div>
    <div class="sig-line">My Commission Expires</div>
  </div>
  </body></html>`;
}

export function renderAssetInventory(ctx: WillRenderContext): string {
  const rows = Array.isArray(ctx.assetsList) ? ctx.assetsList : [];
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const table = rows.length
    ? `<table style="width:100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #111; padding:6px 4px;">Asset</th>
            <th style="text-align:left; border-bottom:1px solid #111; padding:6px 4px;">Type</th>
            <th style="text-align:left; border-bottom:1px solid #111; padding:6px 4px;">Ownership</th>
            <th style="text-align:right; border-bottom:1px solid #111; padding:6px 4px;">Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
                <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb;">${r.name || "Asset"}</td>
                <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb;">${r.type || ""}</td>
                <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb;">${r.isJoint ? "Joint" : "Individual"}</td>
                <td style="padding:6px 4px; border-bottom:1px solid #e5e7eb; text-align:right;">$${(Number(r.value) || 0).toLocaleString()}</td>
              </tr>`
            )
            .join("")}
          <tr>
            <td colspan="3" style="padding:8px 4px; text-align:right; font-weight:600;">Total</td>
            <td style="padding:8px 4px; text-align:right; font-weight:600;">$${total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>`
    : `<div class="box">No assets listed.</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${baseCss}
    table { font-size: 14px; }
  </style></head><body>
    <h1>Asset Inventory</h1>
    <p class="small">This inventory is provided to assist the Executor in identifying and administering the estate. It is not necessarily comprehensive and may be updated over time.</p>
    ${table}
  </body></html>`;
}
