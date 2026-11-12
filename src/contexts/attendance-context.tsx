"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useCurrentUser, useRole } from "@/contexts/role-context";
import { DEMO_MODE } from "@/lib/demo";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/contexts/data-context";

export type AttendanceResult = { success: boolean; error?: string };

interface AttendanceContextType {
  isCheckedIn: boolean;
  checkInTime: Date | null;
  elapsedSeconds: number;
  weeklyAccumulatedHours: number;
  weeklyTargetHours: number;
  checkIn: () => Promise<AttendanceResult>;
  checkOut: () => Promise<AttendanceResult>;
  resetWeeklyDemo: () => void;
  formattedElapsed: string;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useRole();
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [weeklyAccumulatedHours, setWeeklyAccumulatedHours] = useState<number>(6.5);
  const weeklyTargetHours = currentUser?.weeklyTargetHours || 10;

  useEffect(() => {
    if (!isCheckedIn || !checkInTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - checkInTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isCheckedIn, checkInTime]);

  const checkIn = async (): Promise<AttendanceResult> => {
    if (!currentUser) {
      return { success: false, error: "Belum masuk. Silakan login terlebih dahulu." };
    }
    if (currentUser.teamType === "ukm") {
      return {
        success: false,
        error: "Anggota UKM Roboholic tidak memiliki kewajiban absensi jam lab.",
      };
    }
    if (DEMO_MODE) {
      return { success: false, error: "MODE DEMO: presensi tidak disimpan ke database." };
    }

    const now = new Date();
    const supabase = createClient();
    const { error } = await supabase.from("attendance_sessions").insert([
      {
        user_id: currentUser.id,
        kelompok_id: currentUser.teamId,
        check_in: now.toISOString(),
      },
    ]);

    if (error) {
      return { success: false, error: friendlyError(error) };
    }

    setCheckInTime(now);
    setIsCheckedIn(true);
    setElapsedSeconds(0);
    return { success: true };
  };

  const checkOut = async (): Promise<AttendanceResult> => {
    if (!currentUser) {
      return { success: false, error: "Belum masuk. Silakan login terlebih dahulu." };
    }
    if (!checkInTime) return { success: false, error: "Tidak ada sesi aktif." };
    if (DEMO_MODE) {
      return { success: false, error: "MODE DEMO: presensi tidak disimpan ke database." };
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .update({ check_out: new Date().toISOString() })
      .eq("user_id", currentUser.id)
      .is("check_out", null)
      .select("id");

    if (error) {
      return { success: false, error: friendlyError(error) };
    }
    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Sesi aktif tidak ditemukan di database. Hubungi admin laboratorium.",
      };
    }

    const addedHours = Math.max(0.2, Number((elapsedSeconds / 3600).toFixed(2)));
    setWeeklyAccumulatedHours((prev) => Number((prev + addedHours).toFixed(2)));
    setIsCheckedIn(false);
    setCheckInTime(null);
    setElapsedSeconds(0);
    return { success: true };
  };

  const resetWeeklyDemo = () => {
    setWeeklyAccumulatedHours(0);
    setIsCheckedIn(false);
    setCheckInTime(null);
    setElapsedSeconds(0);
  };

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const formattedElapsed = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <AttendanceContext.Provider
      value={{
        isCheckedIn,
        checkInTime,
        elapsedSeconds,
        weeklyAccumulatedHours,
        weeklyTargetHours,
        checkIn,
        checkOut,
        resetWeeklyDemo,
        formattedElapsed,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error("useAttendance must be used within an AttendanceProvider");
  }
  return context;
}
