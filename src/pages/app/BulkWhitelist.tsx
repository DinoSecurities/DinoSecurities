import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Download, Loader2, CheckCircle2, XCircle, FileSpreadsheet, ShieldAlert,
} from "lucide-react";
import { useIndexedSecurityByMint } from "@/hooks/useIndexedSecurities";
import {
  validateRow,
  buildBulkTransactions,
  submitBulkTransactions,
  CSV_TEMPLATE,
  type BulkRow,
  type BulkRowError,
  type BulkResult,
} from "@/lib/bulkWhitelist";
import { truncateAddress, getExplorerUrl } from "@/lib/solana";

/**
 * Bulk Whitelist Import — paste a CSV, we validate every row, you sign
 * once (Phantom's signAllTransactions), we co-sign + submit in chunks
 * through the same sanctions-screened oracle path that single-row
 * registration uses. No shortcut — the exact same safety net runs.
 */
const BulkWhitelist = () => {
  const { mint } = useParams<{ mint: string }>();
  const { connection } = useConnection();
  const wallet = useWallet();

  const sec = useIndexedSecurityByMint(mint);
  const oraclePubkey = import.meta.env.VITE_KYC_ORACLE_PUBKEY as string | undefined;

  const [rawText, setRawText] = useState("");
  const [valid, setValid] = useState<BulkRow[]>([]);
  const [invalid, setInvalid] = useState<BulkRowError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkResult[]>([]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRawText(text);
      parseAndValidate(text);
    };
    reader.readAsText(file);
  };

  const parseAndValidate = (text: string) => {
    setResults([]);
    setProgress({ done: 0, total: 0 });
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    const goodRows: BulkRow[] = [];
    const badRows: BulkRowError[] = [];
    parsed.data.forEach((row, i) => {
      const result = validateRow(row, i + 2); // +2: 1-indexed + header row
      if ("error" in result) badRows.push(result);
      else goodRows.push(result);
    });
    setValid(goodRows);
    setInvalid(badRows);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dino-whitelist-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const canSubmit = useMemo(
    () => valid.length > 0 && !!wallet.publicKey && !!mint && !!oraclePubkey && !submitting,
    [valid, wallet.publicKey, mint, oraclePubkey, submitting],
  );

  const submit = async () => {
    if (!mint || !oraclePubkey || !wallet.publicKey || !wallet.signAllTransactions) {
      toast.error("Wallet not ready");
      return;
    }
    setSubmitting(true);
    setResults([]);
    setProgress({ done: 0, total: valid.length });
    try {
      const txs = await buildBulkTransactions(connection, wallet, mint, valid, oraclePubkey);
      toast.message(
        `Prepared ${txs.length} transaction${txs.length === 1 ? "" : "s"} — Phantom will ask to sign all of them at once.`,
      );
      const signed = await wallet.signAllTransactions(txs);
      toast.message("Submitting to oracle in chunks of 20…");
      const rowIndices = valid.map((r) => r.rowIndex);
      const out = await submitBulkTransactions(signed, rowIndices, (done, total) => {
        setProgress({ done, total });
      });
      setResults(out);
      const succ = out.filter((r) => r.success).length;
      const fail = out.length - succ;
      if (fail === 0) toast.success(`All ${succ} rows whitelisted.`);
      else toast.warning(`${succ} succeeded, ${fail} failed — see per-row status.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Bulk whitelist failed");
    } finally {
      setSubmitting(false);
    }
  };

  const resultByRow = useMemo(() => new Map(results.map((r) => [r.rowIndex, r])), [results]);

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/app/issue"
        className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back to Issuer Portal
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet size={16} className="text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Compliance / Onboarding
          </span>
        </div>
        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
          Bulk Whitelist Import
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Upload a CSV of existing investors for <span className="font-mono text-foreground">{sec.data?.symbol ?? truncateAddress(mint ?? "")}</span>.
          We validate every row, you sign all transactions in one Phantom popup, each row
          gets sanctions-screened and oracle-cosigned on the way to mainnet. Rows whose
          HolderRecord PDA already exists are no-ops — safe to re-run.
        </p>
      </div>

      <div className="border border-border bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] p-5 flex flex-col md:flex-row gap-4 items-start">
        <label className="flex-1 border border-dashed border-border hover:border-primary/50 p-6 flex flex-col items-center text-center cursor-pointer transition-colors">
          <Upload size={20} className="text-muted-foreground mb-2" />
          <span className="text-sm font-semibold text-foreground">Drop or pick a CSV</span>
          <span className="text-[11px] text-muted-foreground mt-1">
            Columns: <code>wallet, jurisdiction, accredited, ttl_days, notes</code>
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            className="hidden"
          />
        </label>
        <div className="flex flex-col gap-2 md:w-48 shrink-0">
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-1.5 px-3 py-2 border border-border text-[10px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Download size={12} /> CSV Template
          </button>
        </div>
      </div>

      {rawText && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <Stat label="Parsed rows" value={`${valid.length + invalid.length}`} />
          <Stat label="Valid" value={`${valid.length}`} tint={valid.length > 0 ? "emerald" : undefined} />
          <Stat label="Invalid" value={`${invalid.length}`} tint={invalid.length > 0 ? "red" : undefined} />
          <Stat
            label="Submitted"
            value={
              submitting
                ? `${progress.done} / ${progress.total}`
                : results.length > 0
                  ? `${results.filter((r) => r.success).length} / ${results.length}`
                  : "—"
            }
          />
        </div>
      )}

      {valid.length > 0 && (
        <div className="border border-border">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Preview ({valid.length} valid row{valid.length === 1 ? "" : "s"})
            </span>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
              {submitting ? `Submitting ${progress.done}/${progress.total}` : `Sign & submit ${valid.length}`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Row</th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Wallet</th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Jur.</th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Accredited</th>
                  <th className="text-left p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">TTL</th>
                  <th className="text-right p-3 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {valid.map((r) => {
                  const result = resultByRow.get(r.rowIndex);
                  return (
                    <tr key={r.rowIndex} className="border-b border-border/30 last:border-b-0 hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-xs font-mono text-muted-foreground">{r.rowIndex}</td>
                      <td className="p-3 text-xs font-mono text-foreground">{truncateAddress(r.wallet)}</td>
                      <td className="p-3 text-xs text-foreground">{r.jurisdiction}</td>
                      <td className="p-3 text-xs text-foreground">{r.accredited ? "Yes" : "No"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{r.ttlDays}d</td>
                      <td className="p-3 text-right">
                        {result
                          ? result.success
                            ? (
                              <a
                                href={result.signature ? getExplorerUrl(result.signature, "tx") : undefined}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-emerald-400 hover:underline"
                              >
                                <CheckCircle2 size={11} /> Whitelisted
                              </a>
                            )
                            : (
                              <span
                                title={result.error}
                                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-red-400"
                              >
                                {result.code === "SANCTIONS_MATCH" ? <ShieldAlert size={11} /> : <XCircle size={11} />}
                                {result.code === "SANCTIONS_MATCH" ? "Blocked" : "Failed"}
                              </span>
                            )
                          : submitting
                            ? <Loader2 size={11} className="animate-spin text-muted-foreground inline" />
                            : <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invalid.length > 0 && (
        <div className="border border-red-400/40 bg-red-400/5 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <XCircle size={14} className="text-red-400" />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-red-400">
              {invalid.length} row{invalid.length === 1 ? "" : "s"} rejected
            </span>
          </div>
          <ul className="text-xs text-muted-foreground flex flex-col gap-1 ml-6">
            {invalid.slice(0, 20).map((e) => (
              <li key={e.rowIndex}><span className="font-mono">Row {e.rowIndex}:</span> {e.error}</li>
            ))}
            {invalid.length > 20 && <li className="italic">…and {invalid.length - 20} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, tint }: { label: string; value: string; tint?: "emerald" | "red" }) {
  const tintClass =
    tint === "emerald" ? "text-emerald-400"
      : tint === "red" ? "text-red-400"
      : "text-foreground";
  return (
    <div className="border border-border p-3 flex flex-col gap-0.5 bg-background/40">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <span className={`text-lg font-mono font-semibold ${tintClass}`}>{value}</span>
    </div>
  );
}

export default BulkWhitelist;
