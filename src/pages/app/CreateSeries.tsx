import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Settings,
  Shield,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { createSecuritySeriesOnChain, hashFile } from "@/lib/createSeriesOnChain";
import { uploadLegalDocument } from "@/lib/uploadDocument";
import { getExplorerUrl, truncateAddress } from "@/lib/solana";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { num: 1, label: "Legal Document", icon: Upload },
  { num: 2, label: "Metadata", icon: FileText },
  { num: 3, label: "Transfer Restrictions", icon: Shield },
  { num: 4, label: "Review", icon: Settings },
  { num: 5, label: "Deploy", icon: Check },
];

const CreateSeries = () => {
  const { connected } = useWallet();
  const wallet = useWallet();
  const { connection } = useConnection();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  // Tracks whether the user has attempted to advance from step 2. Before
  // that, inputs render neutral; after a failed "Next" click we mark them
  // red until the user fixes them.
  const [step2Attempted, setStep2Attempted] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Legal doc
    legalDocFile: null as File | null,
    docUri: "",
    docHash: "",
    // Step 2: Metadata
    name: "",
    symbol: "",
    securityType: "Equity" as "Equity" | "Debt" | "Fund" | "LLC",
    isin: "",
    jurisdiction: "US",
    maxSupply: "",
    description: "",
    // Step 3: Transfer restrictions
    regulation: "RegD" as "RegD" | "RegS" | "RegCF" | "RegA+" | "Ricardian" | "None",
    maxHolders: "",
    lockupPeriodDays: "",
    // Step 5: Deploy
    deploying: false,
    deployed: false,
    txSignature: "",
    mintAddress: "",
    deployError: "",
    // Document upload state
    uploading: false,
    uploadError: "",
  });

  const handleFile = async (file: File | null) => {
    updateField("legalDocFile", file);
    updateField("uploadError", "");
    updateField("docUri", "");
    updateField("docHash", "");
    if (!file) return;
    updateField("uploading", true);
    try {
      const res = await uploadLegalDocument({
        file,
        securityType: formData.securityType,
        isin: formData.isin,
        jurisdiction: formData.jurisdiction,
      });
      updateField("docUri", res.uri);
      updateField("docHash", res.hash);
      toast.success(
        res.uri.startsWith("ar://dev-")
          ? "Doc hashed (Irys not configured — using dev URI)"
          : `Uploaded to Arweave: ${res.uri}`,
      );
    } catch (err: any) {
      updateField("uploadError", err?.message ?? String(err));
      toast.error("Upload failed: " + (err?.message ?? err));
    } finally {
      updateField("uploading", false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Step 2 input sanitisation + validation ---------------------------
  // Kept close to the render so the rules are obvious when reading the UI.
  const MAX_SUPPLY_CAP = 10_000_000;
  const sanitize = {
    // Allow letters, numbers, spaces, common punctuation; cap at 64 chars.
    name: (v: string) => v.replace(/[^A-Za-z0-9 ,.'&\-]/g, "").slice(0, 64),
    // Symbols are uppercase + digits + hyphen only, up to 16 chars.
    symbol: (v: string) => v.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 16),
    // ISIN: 2 letters + 10 alphanumeric, always uppercased, 12 chars max.
    isin: (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12),
    // Jurisdiction: 2 uppercase letters (ISO country code).
    jurisdiction: (v: string) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2),
    // Max supply: digits only, no leading zeros beyond the first character.
    maxSupply: (v: string) => v.replace(/[^0-9]/g, "").slice(0, 8),
    // Description: no control chars; cap at 500.
    description: (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 500),
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!formData.name || formData.name.trim().length < 3) e.name = "At least 3 characters";
    if (!formData.symbol || formData.symbol.length < 2) e.symbol = "2–16 uppercase chars";
    if (formData.isin && formData.isin.length !== 12) e.isin = "ISIN must be 12 chars";
    if (!formData.description || formData.description.trim().length < 10) e.description = "At least 10 characters";
    const supply = Number(formData.maxSupply || 0);
    if (!supply) e.maxSupply = "Required";
    else if (supply > MAX_SUPPLY_CAP) e.maxSupply = `Cap is ${MAX_SUPPLY_CAP.toLocaleString()}`;
    return e;
  }, [formData.name, formData.symbol, formData.isin, formData.description, formData.maxSupply]);

  const canProceed = () => {
    switch (step) {
      case 1: return Boolean(formData.docUri) && !formData.uploading;
      case 2: return Object.keys(errors).length === 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step === 2 && Object.keys(errors).length > 0) {
      setStep2Attempted(true);
      return;
    }
    if (step === 4) setStep(5);
    else setStep((s) => Math.min(5, s + 1) as Step);
  };

  const handleDeploy = async () => {
    updateField("deploying", true);
    updateField("deployError", "");
    try {
      // Prefer the server-returned hash from the Irys upload (authoritative),
      // fall back to client-side hashing if the user pasted an ar:// URI
      // without going through the upload flow.
      const docHash = formData.docHash
        ? Uint8Array.from((formData.docHash.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
        : formData.legalDocFile
          ? await hashFile(formData.legalDocFile)
          : undefined;

      const result = await createSecuritySeriesOnChain(connection, wallet, {
        name: formData.name,
        symbol: formData.symbol,
        securityType: formData.securityType,
        jurisdiction: formData.jurisdiction,
        maxSupply: BigInt(formData.maxSupply || "0"),
        isin: formData.isin,
        regulation: formData.regulation,
        docUri: formData.docUri || undefined,
        docHash,
      });

      toast.success(`Series live! Mint: ${truncateAddress(result.mintAddress)}`);
      updateField("deployed", true);
      updateField("mintAddress", result.mintAddress);
      updateField("txSignature", result.signatures.createSeries);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      updateField("deployError", msg);
      toast.error("Deployment failed: " + msg);
    } finally {
      updateField("deploying", false);
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-sm text-muted-foreground">Connect your wallet to create a security series.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Link to="/app/issue" className="p-2 border border-border hover:bg-secondary transition-colors">
          <ArrowLeft size={16} className="text-muted-foreground" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Create Security Series</h2>
          <p className="text-sm text-muted-foreground">Step {step} of 5</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s) => (
          <div key={s.num} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-colors w-full ${
              step === s.num ? "bg-primary/20 text-primary border border-primary/40" :
              step > s.num ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/30" :
              "bg-secondary/60 text-muted-foreground border border-border"
            }`}>
              <s.icon size={14} />
              <span className="hidden sm:inline truncate">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-8">
        {/* Step 1: Legal Document */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Upload Legal Document</h3>
              <p className="text-xs text-muted-foreground">Upload your Operating Agreement or Prospectus. It will be stored permanently on Arweave.</p>
            </div>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border p-12 flex flex-col items-center gap-4 hover:border-primary/40 transition-colors cursor-pointer"
            >
              <Upload size={32} className="text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-foreground font-medium">Drop your PDF here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, max 50MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {formData.legalDocFile && (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 border border-primary/30">
                    <FileText size={14} className="text-primary" />
                    <span className="text-xs text-foreground flex-1 truncate">{formData.legalDocFile.name}</span>
                    {formData.uploading && <Loader2 size={12} className="text-primary animate-spin" />}
                    {!formData.uploading && formData.docUri && <Check size={14} className="text-emerald-400" />}
                  </div>
                  {formData.docHash && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      sha256: {formData.docHash}
                    </div>
                  )}
                  {formData.docUri && (
                    <div className="text-[10px] text-primary font-mono truncate">{formData.docUri}</div>
                  )}
                  {formData.uploadError && (
                    <div className="text-[10px] text-red-400">{formData.uploadError}</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Or paste Arweave URI</label>
              <input
                value={formData.docUri}
                onChange={(e) => updateField("docUri", e.target.value)}
                placeholder="ar://..."
                className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        )}

        {/* Step 2: Metadata */}
        {step === 2 && (() => {
          const show = (field: string) => step2Attempted && errors[field];
          const inputClass = (field: string) =>
            `mt-2 w-full bg-secondary border px-4 py-2.5 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50 ${
              show(field) ? "border-red-500/70 focus:border-red-500" : "border-border focus:border-primary/50"
            }`;
          const errorText = (field: string) =>
            show(field) ? <div className="text-[10px] text-red-400 mt-1">{errors[field]}</div> : null;
          return (
            <div className="flex flex-col gap-5">
              <h3 className="text-sm font-semibold text-foreground">Security Metadata</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Name</label>
                  <input
                    value={formData.name}
                    onChange={(e) => updateField("name", sanitize.name(e.target.value))}
                    placeholder="DinoVentures Series A"
                    maxLength={64}
                    className={inputClass("name")}
                  />
                  {errorText("name")}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Symbol</label>
                  <input
                    value={formData.symbol}
                    onChange={(e) => updateField("symbol", sanitize.symbol(e.target.value))}
                    placeholder="DINO-A"
                    maxLength={16}
                    className={inputClass("symbol")}
                  />
                  {errorText("symbol")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Security Type</label>
                  <select
                    value={formData.securityType}
                    onChange={(e) => updateField("securityType", e.target.value)}
                    className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none"
                  >
                    <option value="Equity">Equity</option>
                    <option value="Debt">Debt</option>
                    <option value="Fund">Fund</option>
                    <option value="LLC">LLC</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Jurisdiction</label>
                  <input
                    value={formData.jurisdiction}
                    onChange={(e) => updateField("jurisdiction", sanitize.jurisdiction(e.target.value))}
                    placeholder="US"
                    maxLength={2}
                    className="mt-2 w-full bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Max Supply <span className="text-muted-foreground/60 normal-case">(cap {MAX_SUPPLY_CAP.toLocaleString()})</span>
                  </label>
                  <input
                    value={formData.maxSupply}
                    onChange={(e) => updateField("maxSupply", sanitize.maxSupply(e.target.value))}
                    inputMode="numeric"
                    placeholder="10000000"
                    className={inputClass("maxSupply")}
                  />
                  {errorText("maxSupply")}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ISIN (optional)</label>
                  <input
                    value={formData.isin}
                    onChange={(e) => updateField("isin", sanitize.isin(e.target.value))}
                    placeholder="US1234567890"
                    maxLength={12}
                    className={inputClass("isin")}
                  />
                  {errorText("isin")}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Description <span className="text-muted-foreground/60 normal-case">({formData.description.length}/500)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField("description", sanitize.description(e.target.value))}
                  rows={3}
                  placeholder="Describe this security series…"
                  className={`mt-2 w-full bg-secondary border px-4 py-2.5 text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50 resize-none ${
                    show("description") ? "border-red-500/70 focus:border-red-500" : "border-border focus:border-primary/50"
                  }`}
                />
                {errorText("description")}
              </div>
              {step2Attempted && Object.keys(errors).length > 0 && (
                <div className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400">
                  Fix the highlighted fields before continuing.
                </div>
              )}
            </div>
          );
        })()}

        {/* Step 3: Transfer Restrictions */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h3 className="text-sm font-semibold text-foreground">Transfer Restrictions</h3>
            <p className="text-xs text-muted-foreground">These are enforced on-chain via the Transfer Hook program on every token transfer.</p>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Regulation Type</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["RegD", "RegS", "RegCF", "RegA+", "Ricardian", "None"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => updateField("regulation", r)}
                    className={`p-3 text-xs font-semibold text-center border transition-colors ${
                      formData.regulation === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {formData.regulation === "RegD" && (
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30">
                <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Reg D 506(b/c):</strong> Only accredited investors. Transfer hook will check is_accredited flag on HolderRecord PDA for every transfer.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <h3 className="text-sm font-semibold text-foreground">Review & Confirm</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Name", formData.name],
                ["Symbol", formData.symbol],
                ["Type", formData.securityType],
                ["Jurisdiction", formData.jurisdiction],
                ["Max Supply", Number(formData.maxSupply).toLocaleString()],
                ["ISIN", formData.isin || "—"],
                ["Regulation", formData.regulation],
                ["Document", formData.docUri || formData.legalDocFile?.name || "—"],
              ].map(([label, value]) => (
                <div key={label} className="p-3 bg-secondary/60 border border-border">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
                  <div className="text-sm text-foreground mt-1 font-mono truncate">{value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/30">
              <Shield size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                This will create a Token-2022 mint with Transfer Hook, Default Frozen state, Metadata Pointer, and Permanent Delegate extensions. The legal document hash will be stored immutably on-chain.
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Deploy */}
        {step === 5 && (
          <div className="flex flex-col items-center gap-6 py-8">
            {!formData.deployed && !formData.deploying && (
              <>
                <div className="w-16 h-16 border border-primary/40 bg-primary/10 flex items-center justify-center">
                  <Check size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground">Ready to Deploy</h3>
                  <p className="text-sm text-muted-foreground mt-1">This will submit a transaction to Solana.</p>
                </div>
                <button
                  onClick={handleDeploy}
                  className="px-8 py-3 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Deploy Security Series
                </button>
              </>
            )}
            {formData.deploying && (
              <>
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Deploying to Solana...</p>
              </>
            )}
            {formData.deployed && (
              <>
                <div className="w-16 h-16 border border-emerald-400/40 bg-emerald-400/10 flex items-center justify-center">
                  <Check size={28} className="text-emerald-400" />
                </div>
                <div className="text-center max-w-md">
                  <h3 className="text-lg font-semibold text-foreground">Series Live On Devnet</h3>
                  <div className="mt-3 flex flex-col gap-1 text-xs">
                    <div className="text-muted-foreground">Mint:</div>
                    <a
                      href={getExplorerUrl(formData.mintAddress, "address")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-mono hover:underline flex items-center gap-1 justify-center"
                    >
                      {truncateAddress(formData.mintAddress)} <ExternalLink size={10} />
                    </a>
                    <div className="text-muted-foreground mt-2">Transaction:</div>
                    <a
                      href={getExplorerUrl(formData.txSignature, "tx")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-mono hover:underline flex items-center gap-1 justify-center break-all"
                    >
                      {truncateAddress(formData.txSignature)} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
                <Link
                  to="/app/issue"
                  className="px-6 py-2 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Back to Portal
                </Link>
              </>
            )}
            {formData.deployError && !formData.deploying && !formData.deployed && (
              <div className="border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-400 max-w-md break-words">
                {formData.deployError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      {step < 5 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={handleNext}
            // On step 2 the button stays enabled when invalid so the user
            // gets the red-highlight feedback. Other steps still gate
            // purely on canProceed().
            disabled={step === 2 ? false : !canProceed()}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-30 transition-colors"
          >
            {step === 4 ? "Deploy" : "Next"} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateSeries;
