// Self-check for the flow engine's pure logic. Run: npx tsx scripts/test-flow-logic.ts
import assert from "node:assert/strict";
import { containsAnyPhrase, evalConditions, matchKeyword, matchMenuOption, pickWeighted, renderTemplate, validateAnswer, zonedParts } from "../src/modules/flows/logic";
import { emptyGraph, outputsOf, validateGraph, type FlowGraph } from "../src/modules/flows/types";

const opts = [{ id: "a", text: "Preços" }, { id: "b", text: "Horários" }];
assert.equal(matchMenuOption("1", opts)?.id, "a");
assert.equal(matchMenuOption(" 2. ", opts)?.id, "b");
assert.equal(matchMenuOption("precos", opts)?.id, "a");
assert.equal(matchMenuOption("9", opts), null);
assert.equal(matchMenuOption("oi", opts), null);

assert.equal(validateAnswer("email", { text: "Fulano@Mail.com ", type: "TEXT" }), "fulano@mail.com");
assert.equal(validateAnswer("email", { text: "fulano@", type: "TEXT" }), null);
assert.equal(validateAnswer("cpf", { text: "529.982.247-25", type: "TEXT" }), "52998224725");
assert.equal(validateAnswer("cpf", { text: "111.111.111-11", type: "TEXT" }), null);
assert.equal(validateAnswer("number", { text: "1.500,75", type: "TEXT" }), "1500.75");
assert.equal(validateAnswer("number", { text: "abc", type: "TEXT" }), null);
assert.equal(validateAnswer("date", { text: "31/12/2026", type: "TEXT" }), "2026-12-31");
assert.equal(validateAnswer("date", { text: "31/02/2026", type: "TEXT" }), null);
assert.equal(validateAnswer("datetime", { text: "01/02/2026 9:05", type: "TEXT" }), "2026-02-01 09:05");
assert.equal(validateAnswer("firstName", { text: "Ana Maria Souza", type: "TEXT" }), "Ana");
assert.equal(validateAnswer("lastName", { text: "Ana Maria Souza", type: "TEXT" }), "Maria Souza");
assert.equal(validateAnswer("image", { text: "", type: "IMAGE", mediaUrl: "/api/media/x.jpg" }), "/api/media/x.jpg");
assert.equal(validateAnswer("image", { text: "oi", type: "TEXT" }), null);

assert.equal(renderTemplate("Olá {primeiro-nome}, {nada}!", { "primeiro-nome": "Ana" }), "Olá Ana, !");

assert.ok(matchKeyword("Quero o PREÇO", "preço", "CONTAINS"));
assert.ok(matchKeyword("menu", "Menu", "EXACT"));
assert.ok(!matchKeyword("menus", "menu", "EXACT"));
assert.ok(matchKeyword("pedido 123", "^pedido \\d+$", "REGEX"));
assert.ok(!matchKeyword("x", "(", "REGEX"));

const ctx = { tagIds: ["vip"], weekday: 1, minutes: 9 * 60 + 30, today: "2026-10-16", fields: { idade: "30", nome: "Ána", data: "2026-10-20" } };
assert.ok(evalConditions({ logic: "and", conditions: [{ id: "1", source: "tag", op: "is", value: "vip" }, { id: "2", source: "weekday", op: "is", value: "1" }] }, ctx));
assert.ok(!evalConditions({ logic: "and", conditions: [{ id: "1", source: "tag", op: "is", value: "vip" }, { id: "2", source: "time", op: "before", value: "09:00" }] }, ctx));
assert.ok(evalConditions({ logic: "or", conditions: [{ id: "1", source: "tag", op: "is", value: "x" }, { id: "2", source: "time", op: "after", value: "09:00" }] }, ctx));
assert.ok(evalConditions({ logic: "or", conditions: [{ id: "1", source: "field", fieldKey: "idade", fieldType: "NUMBER", op: "gte", value: "18" }] }, ctx));
assert.ok(evalConditions({ logic: "or", conditions: [{ id: "1", source: "field", fieldKey: "nome", fieldType: "TEXT", op: "is", value: "ana" }] }, ctx));
assert.ok(evalConditions({ logic: "or", conditions: [{ id: "1", source: "field", fieldKey: "data", fieldType: "DATE", op: "after", value: "2026-10-16" }] }, ctx));
assert.ok(!evalConditions({ logic: "or", conditions: [{ id: "1", source: "field", fieldKey: "vazio", fieldType: "TEXT", op: "hasValue", value: "" }] }, ctx));
assert.ok(!evalConditions({ logic: "or", conditions: [] }, ctx));

const r = [{ id: "a", weight: 70 }, { id: "b", weight: 30 }];
assert.equal(pickWeighted(r, 0)?.id, "a");
assert.equal(pickWeighted(r, 0.69)?.id, "a");
assert.equal(pickWeighted(r, 0.71)?.id, "b");

const zp = zonedParts(new Date("2026-10-16T12:00:00Z"), "America/Sao_Paulo");
assert.deepEqual(zp, { weekday: 5, minutes: 9 * 60, today: "2026-10-16" });

// Graph validation
const g0 = emptyGraph();
assert.ok(validateGraph(g0).some(i => i.level === "error"));
const g: FlowGraph = {
    nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "m", type: "menu", position: { x: 1, y: 0 }, data: { question: "Escolha", invalidText: "x", maxErrors: 2, options: [{ id: "o1", text: "A" }], expireValue: 1, expireUnit: "days" } },
    ],
    edges: [{ id: "e", source: "start", sourceHandle: "next", target: "m" }, { id: "e2", source: "m", sourceHandle: "option:o1", target: "m" }],
};
assert.equal(validateGraph(g).filter(i => i.level === "error").length, 0);
assert.ok(validateGraph({ ...g, edges: g.edges.slice(0, 1) }).some(i => i.level === "error" && /sem caminho conectado/.test(i.message)), "resposta solta bloqueia a ativação");
assert.deepEqual(outputsOf(g.nodes[1]).map(o => o.id), ["option:o1", "error", "timeout"]);

// Whole-word matching ("Oi" trigger and intent lists)
for (const t of ["Oi", "oi!", "OI 👋", "Oi, quero saber mais", "  óI  "]) assert.ok(matchKeyword(t, "oi", "WORD"), t);
for (const t of ["Foi", "Depois", "Oito", "oii"]) assert.ok(!matchKeyword(t, "oi", "WORD"), t);
assert.ok(containsAnyPhrase("Quero pedir REEMBOLSO", "garantia, reembols*"));
assert.ok(containsAnyPhrase("não quero receber mais", "nao quero receber, parar"));
assert.ok(!containsAnyPhrase("quero preparar as imagens", "parar, sair"));
assert.ok(!containsAnyPhrase("qualquer coisa", ""));
assert.ok(evalConditions({ logic: "or", conditions: [{ id: "1", source: "field", fieldKey: "msg", fieldType: "TEXT", op: "containsAny", value: "preço, quanto custa" }] }, { ...ctx, fields: { msg: "Oi, quanto custa?" } }));

console.log("flow logic: all checks passed");
