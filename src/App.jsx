import { useState } from "react";
import LeftPanel from "./components/leftpanel/LeftPanel";
import RightPanel from "./components/rightpanel/RightPanel";

const App = () => {
  const [selectedDivision, setSelectedDivision] = useState(null);

  return (
    <div className="app-container">
      <LeftPanel
        selectedDivision={selectedDivision}
        onSelectDivision={setSelectedDivision}
      />

      <RightPanel selectedDivision={selectedDivision} />
    </div>
  );
};

export default App;
