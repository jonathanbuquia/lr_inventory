import { useState } from "react";
import TopSection from "./topsection/TopSection";
import FirstTable from "./textbook/firsttable/FirstTable";
import ReceivedBarChart from "./textbook/chart/ReceivedBarChart";
import GapsSurplusChart from "./textbook/gapssurplus/GapsSurplusChart";
import SourceYearPieCharts from "./textbook/piecharts/SourceYearPieCharts";

import LASView from "./las/LASView";

import ADMSLMView from "./adm-slm/ADMSLMView";

import "./RightPanel.css";

const RightPanel = ({ selectedDivision }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState("ALL");
  const [activeTab, setActiveTab] = useState("textbooks");

  const divisionSlug =
    typeof selectedDivision === "string"
      ? selectedDivision
      : selectedDivision?.slug || "";

  const showPickSchool =
    !divisionSlug || !selectedSchoolId || selectedSchoolId === "ALL";

  return (
    <section className="rp__wrap">
      <TopSection
        selectedDivision={selectedDivision}
        selectedSchoolId={selectedSchoolId}
        setSelectedSchoolId={setSelectedSchoolId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="rp__content">
        {showPickSchool ? (
          <div className="rp__empty">
            {!divisionSlug
              ? "Select a division first."
              : "Select a school to view data."}
          </div>
        ) : (
          <>
            {activeTab === "textbooks" && (
              <>
                {/* FIRST TABLE */}
                <FirstTable
                  selectedDivisionSlug={divisionSlug}
                  selectedSchoolFolderName={selectedSchoolId}
                />

                {/* CHART BELOW TABLE */}
                <ReceivedBarChart
                  selectedDivisionSlug={divisionSlug}
                  selectedSchoolFolderName={selectedSchoolId}
                />

                <GapsSurplusChart
                  selectedDivisionSlug={divisionSlug}
                  selectedSchoolFolderName={selectedSchoolId}
                />
                <SourceYearPieCharts
                  selectedDivisionSlug={divisionSlug}
                  selectedSchoolFolderName={selectedSchoolId}
                />
              </>
            )}

            {activeTab === "las" && (
              <LASView
                selectedDivisionSlug={divisionSlug}
                selectedSchoolFolderName={selectedSchoolId}
              />
            )}

            {activeTab === "adm-slm" && (
              <ADMSLMView
                selectedDivisionSlug={divisionSlug}
                selectedSchoolFolderName={selectedSchoolId}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RightPanel;