const { PrismaClient } = require("@prisma/client");
const XLSX = require("xlsx");
const prisma = new PrismaClient({ log: ["warn", "error"] });

function mapCallOutcome(val) {
  if (!val) return "NOT_CONNECTED";
  return String(val).trim().toLowerCase() === "connected" ? "CONNECTED" : "NOT_CONNECTED";
}

function mapNotConnectedReason(val) {
  if (!val) return "CALL_NOT_PICKED";
  const v = String(val).trim().toLowerCase();
  if (v.includes("switched off") || v.includes("not reachable")) return "SWITCHED_OFF";
  if (v.includes("busy")) return "BUSY";
  if (v.includes("wrong")) return "WRONG_NUMBER";
  if (v.includes("disconnect")) return "DISCONNECTED";
  return "CALL_NOT_PICKED";
}

function mapDisposition(val, callOutcome) {
  if (!val) return callOutcome === "NOT_CONNECTED" ? "NOT_CONNECTED" : null;
  const v = String(val).trim().toLowerCase();
  if (v.includes("site visit scheduled")) return "SITE_VISIT_SCHEDULED";
  if (v.includes("interested") && v.includes("follow")) return "INTERESTED_FOLLOW_UP";
  if (v.includes("not interested")) return "NOT_INTERESTED";
  if (v.includes("switched off") || v.includes("not reachable") || v.includes("not picked") || v.includes("ringing") || v.includes("busy")) return "NOT_CONNECTED";
  if (v.includes("budget mismatch")) return "BUDGET_MISMATCH";
  if (v.includes("location mismatch")) return "LOCATION_MISMATCH";
  if (v.includes("junk") || v.includes("broker")) return "JUNK_BROKER";
  return callOutcome === "NOT_CONNECTED" ? "NOT_CONNECTED" : null;
}

function mapBudget(val) {
  if (!val) return null;
  const v = String(val).trim().toLowerCase();
  if (v.includes("below 75") || v.includes("under 75")) return "L50_75";
  if (v.includes("75") && v.includes("1 crore")) return "L75_PLUS";
  if (v.includes("75 lakh") && v.includes("1")) return "L75_PLUS";
  if (v.includes("1") && v.includes("1.5")) return "L75_PLUS";
  if (v.includes("1.5") || v.includes("above 1") || v.includes("above 2")) return "L75_PLUS";
  if (v.includes("50") && v.includes("75")) return "L50_75";
  if (v.includes("35") && v.includes("50")) return "L35_50";
  if (v.includes("25") && v.includes("35")) return "L25_35";
  if (v.includes("under 25") || v.includes("below 25")) return "UNDER_25L";
  return null;
}

function excelDateToJS(serial) {
  if (!serial || isNaN(Number(serial))) return null;
  return new Date((Math.floor(Number(serial)) - 25569) * 86400 * 1000);
}

function cleanPhone(val) {
  if (!val) return null;
  const p = String(val).replace(/\D/g, "");
  if (p.length === 10) return p;
  if (p.length === 12 && p.startsWith("91")) return p.slice(2);
  return p.slice(-10) || null;
}

async function main() {
  console.log("\n=== SS Realty Data Import ===\n");
  await prisma.$connect();

  console.log("Deleting all ActivityLogs...");
  const dl = await prisma.activityLog.deleteMany();
  console.log("  Deleted: " + dl.count + " logs");

  console.log("Deleting all Leads...");
  const dlead = await prisma.lead.deleteMany();
  console.log("  Deleted: " + dlead.count + " leads\n");

  const wb = XLSX.readFile("C:/Users/Pawan/Downloads/Status.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const rows = rawData.slice(1).filter(r => r[1] && r[2]);
  console.log("Excel rows: " + rows.length + "\n");

  const agentsList = await prisma.agent.findMany();
  const agentMap = {};
  for (const a of agentsList) agentMap[a.name.trim().toLowerCase()] = a.id;
  console.log("Agents in DB: " + Object.keys(agentMap).join(", ") + "\n");

  const phoneMap = new Map();
  for (const row of rows) {
    const phone = cleanPhone(row[3]);
    if (!phone) { console.log("  SKIP no phone: " + row[2]); continue; }
    if (!phoneMap.has(phone)) phoneMap.set(phone, []);
    phoneMap.get(phone).push(row);
  }

  console.log("Unique leads: " + phoneMap.size + "\nImporting...\n");

  let ok = 0, err = 0;

  for (const [phone, interactions] of phoneMap.entries()) {
    try {
      const latest = interactions[interactions.length - 1];
      const agentName = String(latest[1] || "").trim().toLowerCase();
      const agentId = agentMap[agentName] || null;
      const callOutcome = mapCallOutcome(latest[5]);
      const disposition = mapDisposition(latest[6], callOutcome);

      let bestVisitDate = null;
      let bestVisitStatus = "NONE";
      for (const r of interactions) {
        const d = mapDisposition(r[6], mapCallOutcome(r[5]));
        if (d === "SITE_VISIT_SCHEDULED" && r[8]) {
          bestVisitDate = excelDateToJS(r[8]);
          bestVisitStatus = "SCHEDULED";
        }
      }

      const lead = await prisma.lead.create({
        data: {
          phone,
          name: String(latest[2] || "").trim(),
          totalInteractions: interactions.length,
          callOutcome,
          notConnectedReason: callOutcome === "NOT_CONNECTED" ? mapNotConnectedReason(latest[6]) : null,
          disposition,
          budget: mapBudget(latest[9]),
          visitDate: bestVisitDate,
          visitStatus: bestVisitStatus,
          latestRemark: latest[10] ? String(latest[10]).trim() : null,
          assignedAgentId: agentId,
          createdAt: excelDateToJS(interactions[0][0]) || new Date("2026-10-11"),
          updatedAt: excelDateToJS(latest[0]) || new Date("2026-10-12"),
        },
      });

      for (let i = 0; i < interactions.length; i++) {
        const r = interactions[i];
        const rAgentId = agentMap[String(r[1] || "").trim().toLowerCase()] || null;
        const rCallOutcome = mapCallOutcome(r[5]);
        const rDisposition = mapDisposition(r[6], rCallOutcome);
        await prisma.activityLog.create({
          data: {
            leadId: lead.id,
            agentId: rAgentId,
            callOutcome: rCallOutcome,
            notConnectedReason: rCallOutcome === "NOT_CONNECTED" ? mapNotConnectedReason(r[6]) : null,
            disposition: rDisposition,
            budget: mapBudget(r[9]),
            visitDate: rDisposition === "SITE_VISIT_SCHEDULED" ? excelDateToJS(r[8]) : null,
            visitStatus: rDisposition === "SITE_VISIT_SCHEDULED" ? "SCHEDULED" : null,
            remark: r[10] ? String(r[10]).trim() : null,
            interactionNumber: i + 1,
            createdAt: excelDateToJS(r[0]) || new Date("2026-10-11"),
          },
        });
      }

      const proj = String(interactions[0][4] || "").trim();
      console.log("  OK: " + lead.name + " (" + phone + ") | " + (disposition || callOutcome) + " | " + proj + (agentId ? "" : " [NO AGENT]"));
      ok++;
    } catch (e) {
      console.log("  ERR " + phone + ": " + e.message);
      err++;
    }
  }

  console.log("\n=== Import Complete ===");
  console.log("Imported: " + ok + " | Errors: " + err);
}

main().catch(console.error).finally(() => prisma.$disconnect());
