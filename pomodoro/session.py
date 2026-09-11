def next_break(completed_sessions: int) -> str:
    if completed_sessions <= 0:
        raise ValueError
    if completed_sessions % 4 != 0:
        return "short"
    elif completed_sessions % 4 == 0:
        return "long"
