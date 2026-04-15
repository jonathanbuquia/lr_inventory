import { useEffect, useMemo, useState } from "react";
import "./TopSection.css";

const TABS = [
  { key: "textbooks", label: "TextBooks" },
  { key: "las", label: "LAS" },
  { key: "adm-slm", label: "ADM-SLM" },
];

const TopSection = ({
  selectedDivision,
  selectedSchoolId,
  setSelectedSchoolId,
  activeTab,
  setActiveTab,
}) => {
  const [schools, setSchools] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [isMobileTabsOpen, setIsMobileTabsOpen] = useState(false);

  const divisionSlug = selectedDivision?.slug || "";

  useEffect(() => {
    const loadSchools = async () => {
      if (!divisionSlug) {
        setSchools([]);
        setSelectedSchoolId("ALL");
        setSearchValue("");
        setOpenSuggest(false);
        setIsMobileTabsOpen(false);
        return;
      }

      try {
        const res = await fetch(`/data/divisions/${divisionSlug}/schools.json`);
        if (!res.ok) throw new Error("Failed to load schools.json");
        const data = await res.json();

        const list = Array.isArray(data?.schools) ? data.schools : [];
        setSchools(list);

        setSelectedSchoolId("ALL");
        setSearchValue("");
        setOpenSuggest(false);
        setIsMobileTabsOpen(false);
      } catch (err) {
        console.error(err);
        setSchools([]);
        setSelectedSchoolId("ALL");
        setSearchValue("");
        setOpenSuggest(false);
        setIsMobileTabsOpen(false);
      }
    };

    loadSchools();
  }, [divisionSlug, setSelectedSchoolId]);

  const filteredSuggestions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return [];
    return schools
      .filter((s) => (s?.name || "").toLowerCase().includes(q))
      .slice(0, 10);
  }, [schools, searchValue]);

  const pickSchool = (school) => {
    if (!school?.id) return;
    setSelectedSchoolId(school.id);
    setSearchValue("");
    setOpenSuggest(false);
  };

  return (
    <div className="ts__wrap">
      <div className="ts__field ts__field--school">
        <label className="ts__label">School</label>
        <select
          className="ts__select"
          value={selectedSchoolId}
          onChange={(e) => setSelectedSchoolId(e.target.value)}
          disabled={!divisionSlug}
        >
          <option value="ALL">ALL</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ts__field ts__field--search">
        <label className="ts__label">Search</label>

        <div className="ts__searchWrap">
          <input
            className="ts__input"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setOpenSuggest(true);
            }}
            onFocus={() => setOpenSuggest(true)}
            onBlur={() => {
              setTimeout(() => setOpenSuggest(false), 120);
            }}
            placeholder={!divisionSlug ? "Select a division first" : "Type school name..."}
            disabled={!divisionSlug}
            autoComplete="off"
          />

          {openSuggest && filteredSuggestions.length > 0 && (
            <div className="ts__suggest" role="listbox">
              {filteredSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="ts__suggestItem"
                  title={s.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSchool(s)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`ts__tabsDock ${isMobileTabsOpen ? "is-open" : ""}`}>
        <button
          type="button"
          className={`ts__tabsToggle ${isMobileTabsOpen ? "is-open" : ""}`}
          onClick={() => setIsMobileTabsOpen((value) => !value)}
          aria-label={isMobileTabsOpen ? "Hide sheet buttons" : "Show sheet buttons"}
          aria-expanded={isMobileTabsOpen}
          aria-controls="mobile-sheet-tabs"
        >
          <span aria-hidden="true">{isMobileTabsOpen ? ">" : "<"}</span>
        </button>

        <div
          id="mobile-sheet-tabs"
          className={`ts__tabs ${isMobileTabsOpen ? "is-open" : ""}`}
          role="tablist"
          aria-label="Sheets"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ts__tab ${activeTab === t.key ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab(t.key);
                setIsMobileTabsOpen(false);
              }}
              role="tab"
              aria-selected={activeTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopSection;
