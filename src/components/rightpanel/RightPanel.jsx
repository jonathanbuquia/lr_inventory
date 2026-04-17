import { useState } from "react";
import TopSection from "./topsection/TopSection";
import FirstTable from "./textbook/firsttable/FirstTable";
import ReceivedBarChart from "./textbook/chart/ReceivedBarChart";
import GapsSurplusChart from "./textbook/gapssurplus/GapsSurplusChart";
import SourceYearPieCharts from "./textbook/piecharts/SourceYearPieCharts";
import DivisionConsolidatedTable from "./divisionconsolidated/DivisionConsolidatedTable";
import DivisionConsolidatedLAS from "./divisionconsolidated/DivisionConsolidatedLAS";
import DivisionConsolidatedADMSLM from "./divisionconsolidated/DivisionConsolidatedADMSLM";

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

  const hasDivision = Boolean(divisionSlug);
  const hasSelectedSchool =
    selectedSchoolId && selectedSchoolId !== "ALL";

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
        {!hasDivision ? (
          <div className="rp__empty">Select a division first.</div>
        ) : (
          <>
            {activeTab === "textbooks" && (
              <>
                {!hasSelectedSchool ? (
                  <DivisionConsolidatedTable selectedDivision={divisionSlug} />
                ) : (
                  <>
                    <FirstTable
                      selectedDivisionSlug={divisionSlug}
                      selectedSchoolFolderName={selectedSchoolId}
                    />

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
              </>
            )}

            {activeTab === "las" && (
              <>
                {!hasSelectedSchool ? (
                  <DivisionConsolidatedLAS selectedDivision={divisionSlug} />
                ) : (
                  <LASView
                    selectedDivisionSlug={divisionSlug}
                    selectedSchoolFolderName={selectedSchoolId}
                  />
                )}
              </>
            )}

            {activeTab === "adm-slm" && (
              <>
                {!hasSelectedSchool ? (
                  <DivisionConsolidatedADMSLM selectedDivision={divisionSlug} />
                ) : (
                  <ADMSLMView
                    selectedDivisionSlug={divisionSlug}
                    selectedSchoolFolderName={selectedSchoolId}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default RightPanel;
