"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface AttendanceContextType {
  isCheckedIn: boolean;
  checkInTime: Date | null;
  elapsedSeconds: number;
  weeklyAccumulatedHours: number;
  weeklyTargetHours: number;
  checkIn: () => void;
  checkOut: () => void;
  resetWeeklyDemo: () => void;
  formattedElapsed: string;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [weeklyAccumulatedHours, setWeeklyAccumulatedHours] = useState<number>(6.5);
  const weeklyTargetHours = 10;

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isCheckedIn && checkInTime) {
      interval = setInterval(() => {
        const diff = Math.floor((Date.now() - checkInTime.getTime()) / 1000);
        setElapsedSeconds(diff);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isCheckedIn, checkInTime]);

  const checkIn = () => {
    const now = new Date();
    setCheckInTime(now);
    setIsCheckedIn(true);
    setElapsedSeconds(0);
  };

  const checkOut = () => {
    if (checkInTime) {
      const addedHours = Math.max(0.2, Number((elapsedSeconds / 3600).toFixed(2)));
      setWeeklyAccumulatedHours((prev) => Number((prev + addedHours).toFixed(2)));
    }
    setIsCheckedIn(false);
    setCheckInTime(null);
    setElapsedSeconds(0);
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
