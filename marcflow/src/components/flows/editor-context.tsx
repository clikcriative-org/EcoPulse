"use client";

import { createContext, useContext } from "react";
import type { FieldScope, FieldType, GraphIssue, NodeDataMap, NodeType } from "@/modules/flows/types";

export interface FieldDef { id: string; key: string; label: string; type: FieldType; scope: FieldScope }
export interface FlowMeta {
    labels: { id: string; name: string; colorHex: string }[];
    fields: FieldDef[];
    systemFields: { key: string; label: string; type: FieldType }[];
    flows: { id: string; name: string; status: string }[];
}

export interface EditorApi {
    sessionId: string;
    flowId: string;
    meta: FlowMeta;
    reloadMeta: () => Promise<void>;
    issuesByNode: Record<string, GraphIssue[]>;
    stat: (nodeId: string, key: string) => number;
    updateNode: <T extends NodeType>(id: string, data: NodeDataMap[T]) => void;
    requestDelete: (id: string) => void;
    duplicateNode: (id: string) => void;
    openPanel: (id: string) => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
    const ctx = useContext(EditorContext);
    if (!ctx) throw new Error("useEditor fora do editor");
    return ctx;
}

/** All variables usable as {key} in texts, grouped like the picker shows them. */
export function variableGroups(meta: FlowMeta) {
    return [
        { label: "Campos do sistema", items: meta.systemFields.map(f => ({ key: f.key, label: f.label })) },
        { label: "Campos do contato", items: meta.fields.filter(f => f.scope === "CONTACT").map(f => ({ key: f.key, label: f.label })) },
        { label: "Campos do robô", items: meta.fields.filter(f => f.scope === "BOT").map(f => ({ key: f.key, label: f.label })) },
    ].filter(g => g.items.length);
}
