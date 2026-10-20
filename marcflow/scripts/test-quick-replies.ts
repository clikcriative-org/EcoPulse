// Self-check for quick reply validation and #tags. Run: npx tsx scripts/test-quick-replies.ts
import assert from "node:assert/strict";
import { contactVars, dayPeriod, parseActions, renderTags } from "../src/modules/quick-replies/logic";

// #tags: known ones replaced, unknown hashtags kept, punctuation right after a tag works
const vars = contactVars("Maria Clara Souza", "5521999998888@s.whatsapp.net", 9, { cidade: "Niterói" });
assert.equal(renderTags("#saudação, #primeiroNome! (#cidade) #promo", vars), "Bom dia, Maria! (Niterói) #promo");
assert.equal(renderTags("#nome / #numero", vars), "Maria Clara Souza / 5521999998888");
assert.equal(renderTags("#primeiroNome", contactVars("", "1@s.whatsapp.net", 9)), "");
assert.deepEqual([dayPeriod(4).saudacao, dayPeriod(5).saudacao, dayPeriod(12).saudacao, dayPeriod(18).saudacao], ["Boa noite", "Bom dia", "Boa tarde", "Boa noite"]);
assert.equal(vars["periodo-dia"], "manhã");

// Validation: clamps timers, rejects incomplete actions, strips phone formatting
const ok = parseActions([
    { type: "text", text: "oi", typing: 999, wait: -3 },
    { type: "typing", seconds: 0 },
    { type: "contact", name: " Ana ", phone: "+55 (21) 99999-0000" },
    { type: "pin", extra: "ignored" },
]);
assert.deepEqual(ok, [
    { type: "text", text: "oi", typing: 60, wait: 0 },
    { type: "typing", seconds: 1 },
    { type: "contact", name: "Ana", phone: "5521999990000" },
    { type: "pin" },
]);
assert.throws(() => parseActions([]), /pelo menos uma/);
assert.throws(() => parseActions([{ type: "text", text: "  " }]), /Ação 1: escreva/);
assert.throws(() => parseActions([{ type: "image" }]), /envie o arquivo/);
assert.throws(() => parseActions([{ type: "groupInvite", groupJid: "123@s.whatsapp.net" }]), /escolha o grupo/);
assert.throws(() => parseActions([{ type: "addLabel" }]), /etiqueta/);
assert.throws(() => parseActions([{ type: "pix" }]), /desconhecido/);
assert.throws(() => parseActions(Array(31).fill({ type: "pin" })), /No máximo/);

console.log("quick reply logic: ok");
