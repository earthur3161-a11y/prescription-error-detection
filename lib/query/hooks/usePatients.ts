"use client";

import { useQuery } from "@tanstack/react-query";
import { listPatients, searchPatients } from "../../data/repositories/patientRepository";

export function usePatients(search: string = "") {
  return useQuery({
    queryKey: ["patients", search],
    queryFn: () => (search ? searchPatients(search) : listPatients()),
  });
}
