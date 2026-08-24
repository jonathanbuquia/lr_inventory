import { useState } from "react";
import LeftPanel from "./components/leftpanel/LeftPanel";
import RightPanel from "./components/rightpanel/RightPanel";

const App = () => {
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [activeView, setActiveView] = useState("dashboard");

  const handleSelectDivision = (division) => {
    setSelectedDivision(division);
    setActiveView("dashboard");
  };

  const handleOpenRegionalView = () => {
    setActiveView("regional");
  };

  return (
    <div className="app-container">
      <LeftPanel
        selectedDivision={selectedDivision}
        activeView={activeView}
        onSelectDivision={handleSelectDivision}
        onOpenRegionalView={handleOpenRegionalView}
      />

      <RightPanel
        selectedDivision={selectedDivision}
        activeView={activeView}
      />
    </div>
  );
};

export default App;
