import { describe, expect, it } from "vitest";
import { RESOURCE_TITLE_MAX_LENGTH } from "@/db/constants";
import { guessFromFileName } from "./guess";

describe("guessFromFileName", () => {
  it("makes a readable title and keeps the casing", () => {
    expect(guessFromFileName("Intro_to_Graphs.pdf").title).toBe("Intro to Graphs");
    expect(guessFromFileName("  chapter   2 -- trees .PDF").title).toBe("chapter 2 trees");
  });

  it("guesses nothing when the name says nothing", () => {
    expect(guessFromFileName("Graphs.pdf")).toEqual({ title: "Graphs" });
  });

  it("reads English and French type words", () => {
    expect(guessFromFileName("lecture_3.pdf").type).toBe("lecture");
    expect(guessFromFileName("Cours 4.pdf").type).toBe("lecture");
    expect(guessFromFileName("TD2.pdf")).toEqual({ title: "TD2", type: "exercise" });
    expect(guessFromFileName("TD 2.pdf").type).toBe("exercise");
    expect(guessFromFileName("exercices-series.pdf").type).toBe("exercise");
    expect(guessFromFileName("notes_week1.pdf").type).toBe("notes");
    expect(guessFromFileName("corrigé_td2.pdf").type).toBe("solution");
  });

  it("reads sessions and years, and a session means an exam", () => {
    expect(guessFromFileName("final 2023-2024.pdf")).toEqual({
      title: "final 2023-2024",
      type: "exam",
      examSession: "final",
      academicYearStart: 2023,
    });
    expect(guessFromFileName("examen_partiel_2022.pdf")).toMatchObject({ type: "exam", examSession: "partial", academicYearStart: 2022 });
    expect(guessFromFileName("rattrapage-2024/2025.pdf")).toMatchObject({ type: "exam", examSession: "second", academicYearStart: 2024 });
    expect(guessFromFileName("exam_2021.pdf")).toEqual({ title: "exam 2021", type: "exam", academicYearStart: 2021 });
  });

  it("reads words glued to numbers", () => {
    expect(guessFromFileName("Exam2024.pdf")).toEqual({ title: "Exam2024", type: "exam", academicYearStart: 2024 });
    expect(guessFromFileName("Final_Exam2023-2024.pdf")).toMatchObject({ type: "exam", examSession: "final", academicYearStart: 2023 });
    expect(guessFromFileName("cours3_graphes.pdf")).toMatchObject({ title: "cours3 graphes", type: "lecture" });
  });

  it("keeps a lone year without a type", () => {
    expect(guessFromFileName("graphs_2024.pdf")).toEqual({ title: "graphs 2024", academicYearStart: 2024 });
  });

  it("ignores a range that is not one year long", () => {
    expect(guessFromFileName("exam_2020-2024.pdf").academicYearStart).toBeUndefined();
  });

  it("does not make an exam of a session word next to another type or plain words", () => {
    expect(guessFromFileName("lecture_final_notes.pdf").examSession).toBeUndefined();
    expect(guessFromFileName("partial derivatives.pdf")).toEqual({ title: "partial derivatives" });
  });

  it("cuts a long name to the title limit", () => {
    const guess = guessFromFileName(`${"a".repeat(300)}.pdf`);
    expect(Array.from(guess.title)).toHaveLength(RESOURCE_TITLE_MAX_LENGTH);
  });
});
