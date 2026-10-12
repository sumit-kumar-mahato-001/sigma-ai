"""
Seeds the SQLite database with one demo course (Database Management
Systems) so the API has real data to serve immediately, mirroring the
Phase 1 mock JSON. Running this file is idempotent — it skips seeding
if the course already exists.
"""
from app.database import SessionLocal, engine, Base
from app.models.orm import Course, Topic, Material, Chunk

DEMO_COURSE_ID = "dbms"

TOPICS = [
    {"name": "ER Model", "mastery": 85, "prerequisites": []},
    {"name": "SQL", "mastery": 72, "prerequisites": ["ER Model"]},
    {"name": "Normalization", "mastery": 45, "prerequisites": ["1NF", "Functional Dependency"]},
    {"name": "Transactions", "mastery": 30, "prerequisites": ["SQL"]},
]

SEED_CHUNKS = [
    ("Page 38", "Normalization. A relation is in 2NF if it is in 1NF and no non-prime "
                "attribute is partially dependent on any candidate key. Second normal form "
                "removes partial dependency. Third normal form (3NF) further removes "
                "transitive dependencies between non-key attributes."),
    ("Page 96", "Transactions. A transaction is a logical unit of work that follows the "
                "ACID properties: Atomicity, Consistency, Isolation, Durability. COMMIT makes "
                "the changes permanent while ROLLBACK reverts the database to the last "
                "committed state."),
    ("Page 60", "SQL. A JOIN clause combines rows from two or more tables based on a "
                "related column. INNER JOIN returns rows with matching values in both tables."),
    ("Page 12", "ER Model. An entity-relationship model describes real-world entities and "
                "the relationships between them using entities, attributes and relationships."),
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.get(Course, DEMO_COURSE_ID):
            course = Course(id=DEMO_COURSE_ID, title="Database Management Systems")
            db.add(course)

            for t in TOPICS:
                db.add(Topic(course_id=course.id, name=t["name"], mastery=t["mastery"], prerequisites=t["prerequisites"]))

            material = Material(course_id=course.id, kind="pdf", name="DBMS.pdf", status="ready", pages=len(SEED_CHUNKS))
            db.add(material)
            db.commit()
            db.refresh(material)

            for page, text in SEED_CHUNKS:
                db.add(Chunk(material_id=material.id, page=page, text=text))

            db.commit()

        # Seed Python Programming Course from ai-tutor-hackathon/embeddings.json if not present
        python_course_id = "python"
        if not db.get(Course, python_course_id):
            py_course = Course(id=python_course_id, title="Python Programming & Fundamentals")
            db.add(py_course)

            py_topics = [
                {"name": "Introduction to Python", "mastery": 92, "prerequisites": []},
                {"name": "Variables & Syntax", "mastery": 88, "prerequisites": ["Introduction to Python"]},
                {"name": "User Input & Output", "mastery": 80, "prerequisites": ["Variables & Syntax"]},
                {"name": "Data Types & Structures", "mastery": 74, "prerequisites": ["Variables & Syntax"]},
            ]
            for pt in py_topics:
                db.add(Topic(course_id=py_course.id, name=pt["name"], mastery=pt["mastery"], prerequisites=pt["prerequisites"]))

            import json, os
            emb_path = os.path.join(os.path.dirname(__file__), "..", "..", "ai-tutor-hackathon", "embeddings.json")
            if os.path.exists(emb_path):
                try:
                    with open(emb_path, "r", encoding="utf-8") as f:
                        raw_data = json.load(f)

                    # Group chunks by video
                    video_map = {}
                    for item in raw_data:
                        vname = item.get("video", "Python Lecture.mp3").replace(".mp3", "")
                        video_map.setdefault(vname, []).append(item)

                    for vname, vchunks in video_map.items():
                        mat = Material(
                            course_id=py_course.id,
                            kind="video",
                            name=vname,
                            status="ready",
                            pages=len(vchunks)
                        )
                        db.add(mat)
                        db.commit()
                        db.refresh(mat)

                        for vc in vchunks:
                            start_s = int(vc.get("start", 0))
                            end_s = int(vc.get("end", 0))
                            loc = f"{start_s//60:02d}:{start_s%60:02d} - {end_s//60:02d}:{end_s%60:02d}"
                            db.add(Chunk(
                                material_id=mat.id,
                                page=loc,
                                text=vc.get("text", "")
                            ))
                        db.commit()
                except Exception as e:
                    print(f"Error seeding python lecture transcripts: {e}")

            db.commit()

    finally:
        db.close()


if __name__ == "__main__":
    seed()
    print("Database seeding completed.")
