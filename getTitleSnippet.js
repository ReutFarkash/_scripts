/**
 * Parse title like "p;Jane Smith &role=designer" → trigger, clean title, metadata
 */
function getTitleSnippet(msg, prefix = "") {
    console.log("🔍 RAW:", `"${msg}"`);

    if (typeof msg !== "string") {
        console.log("❌ Not string");
        return { trigger: "default", clean: "", full: "", renameTo: "", metadata: {} };
    }

    let input = msg.trim();
    console.log("📝 Trimmed:", `"${input}"`);

    // Extract &key=value metadata
    const metadata = {};
    const paramRegex = /&([a-zA-Z0-9_-]+)=([^&\s]+)/g;
    let match;
    while ((match = paramRegex.exec(input)) !== null) {
        metadata[match[1]] = match[2].trim();
        console.log(`📦 ${match[1]}=${match[2]}`);
    }

    // Remove metadata, split on ;
    input = input.replace(/&[a-zA-Z0-9_-]+=[^&\s]+/g, '').trim();
    console.log("🧹 No metadata:", `"${input}"`);

    const parts = input.split(';');
    const trigger = (parts[0] || '').trim().toLowerCase();
    const cleanTitle = (parts.slice(1).join(';') || '').trim();

    console.log("🎯", { trigger, clean: cleanTitle, metadata });

    return {
        trigger: trigger || "default",
        clean: cleanTitle,
        full: prefix + cleanTitle,
        renameTo: cleanTitle,
        metadata
    };
}

module.exports = getTitleSnippet;
