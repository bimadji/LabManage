"use client";

import React from "react";
import { LoanRequestSheet } from "./loan-request-sheet";
import { RoomBookingDialog } from "./room-booking-dialog";
import { ReportDialog } from "./report-dialog";
import { ReviewRequestSheet } from "./review-request-sheet";
import { useRole } from "@/contexts/role-context";

export function OverlayContainer() {
  const { currentUser, isDemoMode } = useRole();

  // Overlay butuh identitas pemohon; jangan mount sebelum ada sesi.
  if (!currentUser && !isDemoMode) return null;

  return (
    <>
      <LoanRequestSheet />
      <RoomBookingDialog />
      <ReportDialog />
      <ReviewRequestSheet />
    </>
  );
}
