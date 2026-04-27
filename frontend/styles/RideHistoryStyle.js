import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  downloadButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Fixed Filter Styles
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    height: 60,
    justifyContent: 'center',
  },
  filterContentContainer: {
    paddingHorizontal: 15,
    alignItems: 'center',
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minWidth: 100,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#A1D826',
    borderColor: '#8BC220',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  listContainer: {
    padding: 15,
    paddingBottom: 30,
  },
  rideCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 15,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#A1D826',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  routeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  missedBadge: {
    backgroundColor: '#ffeaea',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27ae60',
  },
  dateText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  cardContent: {
    padding: 16,
    paddingTop: 12,
  },
  timeInfo: {
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginRight: 6,
    width: 80,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
  },
  delayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  missedText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  delayedText: {
    color: '#FFA500',
    fontWeight: '600',
  },
  delayText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  driverInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  driverDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 4,
    marginRight: 8,
  },
  ratingLabel: {
    fontSize: 12,
    color: '#666',
  },
  missedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 107, 107, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  missedMessage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B6B',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6c757d',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});