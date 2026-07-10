"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addBatch,
  applyStockAdjustment,
  listBatches,
  listStockAdjustments,
  setBatchRecalled,
} from "../../data/repositories/batchRepository";
import {
  createDispenseRecord,
  listDispenseRecords,
  listDispenseRecordsByPatient,
} from "../../data/repositories/dispenseRecordRepository";
import {
  appendPharmacistAction,
  listActionsByPrescription,
  listAllPharmacistActions,
} from "../../data/repositories/pharmacistActionRepository";
import {
  getPharmacySettings,
  updatePharmacySettings,
} from "../../data/repositories/pharmacySettingsRepository";
import { updatePharmacistNote } from "../../data/repositories/prescriptionRepository";
import { useToastStore } from "../../store/toast-store";

function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[][]) => keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
}

// --- Inventory ---
export function useBatches() {
  return useQuery({ queryKey: ["batches"], queryFn: listBatches });
}

export function usePharmacySettings() {
  return useQuery({ queryKey: ["pharmacySettings"], queryFn: getPharmacySettings });
}

export function useUpdatePharmacySettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: updatePharmacySettings,
    onSuccess: () => invalidate([["pharmacySettings"], ["batches"]]),
  });
}

export function useStockAdjustments() {
  return useQuery({ queryKey: ["stockAdjustments"], queryFn: listStockAdjustments });
}

export function useApplyStockAdjustment() {
  const invalidate = useInvalidate();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: applyStockAdjustment,
    onSuccess: (batch) => {
      invalidate([["batches"], ["stockAdjustments"]]);
      if (batch) showToast({ title: "Stock adjusted", variant: "success" });
      else showToast({ title: "Adjustment rejected", description: "That would take stock below zero.", variant: "error" });
    },
  });
}

export function useAddBatch() {
  const invalidate = useInvalidate();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ batch, pharmacistId }: { batch: Parameters<typeof addBatch>[0]; pharmacistId: string }) =>
      addBatch(batch, pharmacistId),
    onSuccess: () => {
      invalidate([["batches"], ["stockAdjustments"]]);
      showToast({ title: "Batch added to stock", variant: "success" });
    },
  });
}

export function useSetBatchRecalled() {
  const invalidate = useInvalidate();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ batchId, recalled }: { batchId: string; recalled: boolean }) =>
      setBatchRecalled(batchId, recalled),
    onSuccess: (_r, v) => {
      invalidate([["batches"]]);
      showToast({ title: v.recalled ? "Batch flagged as recalled" : "Recall cleared", variant: "warning" });
    },
  });
}

// --- Dispensing ---
export function useDispenseRecords() {
  return useQuery({ queryKey: ["dispenseRecords"], queryFn: listDispenseRecords });
}

export function useDispenseRecordsByPatient(patientId: string | null) {
  return useQuery({
    queryKey: ["dispenseRecords", "patient", patientId],
    queryFn: () => listDispenseRecordsByPatient(patientId as string),
    enabled: !!patientId,
  });
}

export function useCreateDispenseRecord() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: createDispenseRecord,
    onSuccess: () => invalidate([["dispenseRecords"], ["batches"], ["stockAdjustments"]]),
  });
}

// --- Pharmacist actions ---
export function usePharmacistActions(prescriptionId: string | null) {
  return useQuery({
    queryKey: ["pharmacistActions", prescriptionId],
    queryFn: () => listActionsByPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });
}

export function useAllPharmacistActions() {
  return useQuery({ queryKey: ["pharmacistActions"], queryFn: listAllPharmacistActions });
}

export function useAppendPharmacistAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: appendPharmacistAction,
    onSuccess: (action) =>
      invalidate([["pharmacistActions"], ["pharmacistActions", action.prescriptionId]]),
  });
}

export function useUpdatePharmacistNote() {
  const qc = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => updatePharmacistNote(id, note),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["prescription", v.id] });
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      showToast({ title: "Note saved", variant: "success" });
    },
  });
}
