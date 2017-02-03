COLLECTIONS_TEMPLATE_PROPS = ['url','name','pub_country', 'public_notes']
# some useful tag sets
COLLECTIONS_TAG_SET_ID = 5
GV_TAG_SET_ID = 556
EMM_TAG_SET_ID = 597

# metadata tag sets
TAG_SETS_ID_PUBLICATION_COUNTRY = 1935

VALID_METADATA_IDS = [{'pub_country':TAG_SETS_ID_PUBLICATION_COUNTRY}]

def isMetaDataTagSet(metadataTagSetsId):
  for eachMetadataItem in VALID_METADATA_IDS:
  	if int(metadataTagSetsId) in eachMetadataItem.values():
  		return True
  return False
