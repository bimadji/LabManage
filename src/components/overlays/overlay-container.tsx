"use client";

import React from "react";
import { LoanRequestSheet } from "./loan-request-sheet";
import { RoomBookingDialog } from "./room-booking-dialog";
import { ReportDialog } from "./report-dialog";
import { ReviewRequestSheet } from "./review-request-sheet";

export function OverlayContainer() {
  return (
    <>
      <LoanRequestSheet />
      <RoomBookingDialog />
      <ReportDialog />
      <ReviewRequestSheet />
    </>
  );
}
