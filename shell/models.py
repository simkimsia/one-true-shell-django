from django.db import models


class Record(models.Model):
    """One row of any entity in schema/entities.yaml. The auto pk keeps creation order."""

    entity = models.CharField(max_length=64)
    rid = models.CharField(max_length=64)
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ["id"]
        constraints = [models.UniqueConstraint(fields=["entity", "rid"], name="unique_entity_rid")]

    def as_dict(self):
        return {"id": self.rid, **self.data}
