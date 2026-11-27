from pipeline.common.districts import DISTRICTS, BY_ID, by_state


def test_exactly_94_unique_districts():
    assert len(DISTRICTS) == 94
    assert len({d.id for d in DISTRICTS}) == 94


def test_district_counts_per_state():
    expected = {"CA": 4, "NY": 4, "TX": 4, "AL": 3, "FL": 3, "GA": 3, "IL": 3, "LA": 3, "NC": 3,
                "OK": 3, "PA": 3, "TN": 3, "VA": 2, "WY": 1}
    for st, n in expected.items():
        assert len(by_state(st)) == n, st


def test_names_and_circuits():
    assert BY_ID["vaed"].name == "Eastern District of Virginia"
    assert BY_ID["vaed"].short == "E.D. Va."
    assert BY_ID["vaed"].circuit == "4"
    assert BY_ID["dcd"].circuit == "DC"
    assert BY_ID["gud"].article == "IV"
    assert BY_ID["prd"].article == "III"
