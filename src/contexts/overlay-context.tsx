"use client";

import React, { createContext, useContext, useState } from "react";
import { Item, LoanRequest, LabReport } from "@/types";

interface OverlayContextType {
  activeSheet: "loan" | "review" | null;
  activeDialog: "booking" | "report" | null;
  selectedItemForLoan: Item | null;
  selectedRequestForReview: LoanRequest | null;
  selectedReportForReview: LabReport | null;
  openLoanSheet: (item?: Item) => void;
  openReviewSheet: (request: LoanRequest) => void;
  openReportReviewSheet: (report: LabReport) => void;
  openBookingDialog: () => void;
  openReportDialog: () => void;
  closeAllOverlays: () => void;
}

const OverlayContext = createContext<OverlayContextType | undefined>(undefined);

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeSheet, setActiveSheet] = useState<"loan" | "review" | null>(null);
  const [activeDialog, setActiveDialog] = useState<"booking" | "report" | null>(null);
  const [selectedItemForLoan, setSelectedItemForLoan] = useState<Item | null>(null);
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<LoanRequest | null>(null);
  const [selectedReportForReview, setSelectedReportForReview] = useState<LabReport | null>(null);

  const openLoanSheet = (item?: Item) => {
    setSelectedItemForLoan(item || null);
    setActiveSheet("loan");
  };

  const openReviewSheet = (request: LoanRequest) => {
    setSelectedRequestForReview(request);
    setActiveSheet("review");
  };

  const openReportReviewSheet = (report: LabReport) => {
    setSelectedReportForReview(report);
    setActiveSheet("review");
  };

  const openBookingDialog = () => {
    setActiveDialog("booking");
  };

  const openReportDialog = () => {
    setActiveDialog("report");
  };

  const closeAllOverlays = () => {
    setActiveSheet(null);
    setActiveDialog(null);
    setSelectedItemForLoan(null);
    setSelectedRequestForReview(null);
    setSelectedReportForReview(null);
  };

  return (
    <OverlayContext.Provider
      value={{
        activeSheet,
        activeDialog,
        selectedItemForLoan,
        selectedRequestForReview,
        selectedReportForReview,
        openLoanSheet,
        openReviewSheet,
        openReportReviewSheet,
        openBookingDialog,
        openReportDialog,
        closeAllOverlays,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error("useOverlay must be used within an OverlayProvider");
  }
  return context;
}
